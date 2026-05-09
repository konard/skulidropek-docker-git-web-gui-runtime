// CHANGE: HTTP reverse proxy for /b/<session_id>/* → http://127.0.0.1:<host_port>/<sub>
// WHY: ТЗ section 9 requires a single-host gateway routing browser traffic to the right container
// QUOTE(TZ): "Путь /b/<session_id>/vnc.html должен отдавать noVNC-клиент конкретной сессии"
// REF: issue#1 sections 9.1, 9.2
// PURITY: SHELL
// EFFECT: Effect<HttpServerResponse, never, SessionManager | HttpClient>
// INVARIANT: returns 404 for unknown id, 502 for upstream failure, otherwise upstream body+status
// COMPLEXITY: O(1)/O(1) per request (excluding upstream I/O)
import { HttpClient, HttpClientRequest, HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

import { parseGatewayPath } from "../../core/gateway/path.js"
import type { Session } from "../../core/session/types.js"
import { SessionManagerTag } from "../services/manager.js"
import type { SessionNotFound } from "../services/store.js"
import { errorJson } from "./responses.js"

const stripLeadingSlash = (s: string): string => s.startsWith("/") ? s.slice(1) : s

const upstreamUrl = (session: Session, subPath: string, search: string): string => {
  const trimmed = subPath.length === 0 ? "" : stripLeadingSlash(subPath)
  return `http://127.0.0.1:${session.novncPort}/${trimmed}${search}`
}

const proxy = Effect.gen(function*(_) {
  const req = yield* _(HttpServerRequest.HttpServerRequest)
  const route = parseGatewayPath(req.url.split("?")[0] ?? req.url)
  if (route._tag === "None") return yield* _(errorJson(404, "not a /b/<id>/ route"))
  const manager = yield* _(SessionManagerTag)
  const session = yield* _(
    manager.get(route.value.sessionId).pipe(
      Effect.catchTag("SessionNotFound", (e: SessionNotFound) => Effect.fail(e))
    )
  )
  const search = req.url.includes("?") ? `?${req.url.split("?", 2)[1] ?? ""}` : ""
  const url = upstreamUrl(session, route.value.subPath, search)
  const client = yield* _(HttpClient.HttpClient)
  const response = yield* _(client.execute(HttpClientRequest.get(url)))
  const body = yield* _(response.text)
  return HttpServerResponse.text(body, {
    status: response.status,
    contentType: response.headers["content-type"] ?? "application/octet-stream"
  })
}).pipe(
  Effect.catchTag("SessionNotFound", () => errorJson(404, "session not found")),
  Effect.catchAll(() => errorJson(502, "upstream proxy error"))
)

export const gatewayRouter = HttpRouter.empty.pipe(
  HttpRouter.get("/b/*", proxy),
  HttpRouter.post("/b/*", proxy)
)
