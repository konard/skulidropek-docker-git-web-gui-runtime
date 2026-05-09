// CHANGE: HTTP/WebSocket reverse proxy for /b/<session_id>/* → session noVNC upstream
// WHY: ТЗ section 9 requires a single-host gateway routing browser traffic to the right container
// QUOTE(TZ): "Путь /b/<session_id>/vnc.html должен отдавать noVNC-клиент конкретной сессии"
// REF: issue#1 sections 9.1, 9.2
// PURITY: SHELL
// EFFECT: Effect<HttpServerResponse, never, SessionManager | HttpClient | WebSocketConstructor>
// INVARIANT: returns 404 for unknown id, 502 for upstream failure, otherwise proxies bytes/WebSocket frames
// COMPLEXITY: O(1)/O(1) per request (excluding upstream I/O)
import {
  HttpClient,
  HttpClientRequest,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  Socket
} from "@effect/platform"
import { Data, Effect } from "effect"

import { parseGatewayPath } from "../../core/gateway/path.js"
import type { Session } from "../../core/session/types.js"
import { SessionManagerTag } from "../services/manager.js"
import { errorJson } from "./responses.js"

class GatewayRouteNotMatched extends Data.TaggedError("GatewayRouteNotMatched")<Record<string, never>> {}

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
])

const stripLeadingSlash = (s: string): string => s.startsWith("/") ? s.slice(1) : s

const CONTAINER_NOVNC_PORT = 6080

const upstreamHost = (session: Session): string => session.novncHost ?? "127.0.0.1"
const upstreamPort = (session: Session): number => session.novncHost === null ? session.novncPort : CONTAINER_NOVNC_PORT

const upstreamUrl = (session: Session, subPath: string, search: string): string => {
  const trimmed = subPath.length === 0 ? "" : stripLeadingSlash(subPath)
  return `http://${upstreamHost(session)}:${upstreamPort(session)}/${trimmed}${search}`
}

const upstreamWsUrl = (session: Session, subPath: string, search: string): string => {
  const trimmed = subPath.length === 0 ? "" : stripLeadingSlash(subPath)
  return `ws://${upstreamHost(session)}:${upstreamPort(session)}/${trimmed}${search}`
}

const requestPath = (url: string): string => url.split("?")[0] ?? url

const requestSearch = (url: string): string => url.includes("?") ? `?${url.split("?", 2)[1] ?? ""}` : ""

const isWebSocketUpgrade = (req: HttpServerRequest.HttpServerRequest): boolean =>
  req.headers["upgrade"]?.toLowerCase() === "websocket"

const protocols = (header: string | undefined): Array<string> | undefined => {
  const parsed = (header ?? "").split(",").map((p) => p.trim()).filter((p) => p.length > 0)
  return parsed.length === 0 ? undefined : parsed
}

const proxyHeaders = (headers: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(headers).filter(([k]) => !hopByHopHeaders.has(k.toLowerCase())))

const closeSocket = (
  write: (chunk: Uint8Array | string | Socket.CloseEvent) => Effect.Effect<void, Socket.SocketError>
): Effect.Effect<void> =>
  write(new Socket.CloseEvent(1000)).pipe(
    Effect.catchTags({
      SocketError: () => Effect.void
    })
  )

const routeContext = Effect.gen(function*(_) {
  const req = yield* _(HttpServerRequest.HttpServerRequest)
  const route = parseGatewayPath(requestPath(req.url))
  if (route._tag === "None") return yield* _(Effect.fail(new GatewayRouteNotMatched({})))
  const manager = yield* _(SessionManagerTag)
  const session = yield* _(manager.get(route.value.sessionId))
  return { req, route: route.value, search: requestSearch(req.url), session }
})

const proxyHttp = Effect.gen(function*(_) {
  const ctx = yield* _(routeContext)
  const url = upstreamUrl(ctx.session, ctx.route.subPath, ctx.search)
  const client = yield* _(HttpClient.HttpClient)
  const response = yield* _(client.execute(HttpClientRequest.get(url)))
  return HttpServerResponse.stream(response.stream, {
    status: response.status,
    headers: proxyHeaders(response.headers)
  })
})

const proxyWebSocket = Effect.scoped(
  Effect.gen(function*(_) {
    const ctx = yield* _(routeContext)
    const upstream = yield* _(
      Socket.makeWebSocket(upstreamWsUrl(ctx.session, ctx.route.subPath, ctx.search), {
        protocols: protocols(ctx.req.headers["sec-websocket-protocol"])
      })
    )
    const downstream = yield* _(ctx.req.upgrade)
    const writeUpstream = yield* _(upstream.writer)
    const writeDownstream = yield* _(downstream.writer)
    const clientToUpstream = downstream.runRaw((chunk) => writeUpstream(chunk))
    const upstreamToClient = upstream.runRaw((chunk) => writeDownstream(chunk))
    yield* _(
      Effect.raceFirst(clientToUpstream, upstreamToClient).pipe(
        Effect.catchTags({
          SocketError: () => Effect.void
        }),
        Effect.ensuring(Effect.zipRight(closeSocket(writeUpstream), closeSocket(writeDownstream)))
      )
    )
    yield* _(Effect.never)
    return HttpServerResponse.empty()
  })
)

const proxy = Effect.gen(function*(_) {
  const req = yield* _(HttpServerRequest.HttpServerRequest)
  if (isWebSocketUpgrade(req)) return yield* _(proxyWebSocket)
  return yield* _(proxyHttp)
}).pipe(
  Effect.catchTags({
    GatewayRouteNotMatched: () => errorJson(404, "not a /b/<id>/ route"),
    RequestError: () => errorJson(502, "upstream proxy error"),
    ResponseError: () => errorJson(502, "upstream proxy error"),
    SessionNotFound: () => errorJson(404, "session not found")
  })
)

export const gatewayRouter = HttpRouter.empty.pipe(
  HttpRouter.get("/b/*", proxy),
  HttpRouter.post("/b/*", proxy)
)
