// CHANGE: HTTP route tests for /b/<id>/* gateway with a fake HttpClient
// WHY: ТЗ section 9 fixes the proxy contract; verify 404 (no id), 404 (unknown), 200 (proxied)
// REF: issue#1 sections 9.1, 9.2
// PURITY: SHELL TESTS
// INVARIANT: matched id → upstream body returned; unknown id → 404
// COMPLEXITY: O(1) per request
import { HttpApp, HttpClient, HttpClientResponse } from "@effect/platform"
import { Effect, Layer } from "effect"
import { afterAll, describe, expect, it } from "vitest"

import { apiRouter } from "../../src/shell/http/api.js"
import { gatewayRouter } from "../../src/shell/http/gateway.js"
import { FIXED_ID, validCreatePayload } from "../_fixtures.js"
import { makeFreshManagerLayer } from "./_layers.js"

const fakeClient = HttpClient.make((request) =>
  Effect.succeed(
    HttpClientResponse.fromWeb(
      request,
      new Response(`proxied:${request.url}`, {
        status: 200,
        headers: { "content-type": "text/plain" }
      })
    )
  )
)
const httpClientLayer = Layer.succeed(HttpClient.HttpClient, fakeClient)

const managerLayer = makeFreshManagerLayer()
const memoMap = Effect.runSync(Layer.makeMemoMap)
const apiHandler = HttpApp.toWebHandlerLayer(apiRouter, managerLayer, { memoMap })
const gwHandler = HttpApp.toWebHandlerLayer(
  gatewayRouter,
  Layer.mergeAll(managerLayer, httpClientLayer),
  { memoMap }
)

afterAll(() =>
  Effect.runPromise(
    Effect.promise(() => apiHandler.dispose()).pipe(
      Effect.zipRight(Effect.promise(() => gwHandler.dispose()))
    )
  )
)

const post = (path: string, body: object) =>
  Effect.promise(() =>
    apiHandler.handler(
      new Request(`https://t${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
    )
  )

const gwGet = (path: string) => Effect.promise(() => gwHandler.handler(new Request(`https://t${path}`)))

const readText = (res: Response) => Effect.promise(() => res.text())

describe("GET /b/<id>/<sub>", () => {
  it("proxies to the upstream and returns its body", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        yield* _(post("/api/sessions", validCreatePayload))
        const res = yield* _(gwGet(`/b/${FIXED_ID}/vnc.html?autoconnect=true`))
        expect(res.status).toBe(200)
        const text = yield* _(readText(res))
        expect(text.startsWith("proxied:http://127.0.0.1:")).toBe(true)
        expect(text.endsWith("/vnc.html?autoconnect=true")).toBe(true)
      })
    ))

  it("returns 404 for an unknown session id", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(gwGet("/b/ffffffffffff/vnc.html"))
        expect(res.status).toBe(404)
      })
    ))

  it("returns 404 for paths that aren't /b/<id>/...", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(gwGet("/b/INVALID/vnc.html"))
        expect(res.status).toBe(404)
      })
    ))
})
