// CHANGE: HTTP route tests for /api/sessions* using a fake Docker layer
// WHY: ТЗ section 8 pins the request/response shapes; verify status codes & DTO keys
// REF: issue#1 section 8
// PURITY: SHELL TESTS
// INVARIANT: POST → 201 + viewer_url; GET unknown → 404; DELETE → 200
// COMPLEXITY: O(1) per request
import { HttpApp } from "@effect/platform"
import { Effect } from "effect"
import { afterAll, describe, expect, it } from "vitest"

import { apiRouter } from "../../src/shell/http/api.js"
import { FIXED_CONTAINER, FIXED_ID, validCreatePayload } from "../_fixtures.js"
import { makeFreshManagerLayer } from "./_layers.js"

interface SessionDto {
  readonly container_id: string
  readonly id: string
  readonly status: string
  readonly viewer_url: string
}

interface ErrorDto {
  readonly error: string
}

interface LogsDto {
  readonly lines: ReadonlyArray<string>
}

const app = HttpApp.toWebHandlerLayer(apiRouter, makeFreshManagerLayer())

afterAll(() => Effect.runPromise(Effect.promise(() => app.dispose())))

const post = (body: object) =>
  Effect.promise(() =>
    app.handler(
      new Request("https://t/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
    )
  )

const get = (path: string) => Effect.promise(() => app.handler(new Request(`https://t${path}`)))
const del = (path: string) => Effect.promise(() => app.handler(new Request(`https://t${path}`, { method: "DELETE" })))

const readJson = <A>(res: Response): Effect.Effect<A> =>
  Effect.promise(() => res.text()).pipe(Effect.map((t) => JSON.parse(t) as A))

const createSession = Effect.flatMap(post(validCreatePayload), (res) => readJson<SessionDto>(res))

const expectStatus = (res: Response, status: number): Effect.Effect<void> =>
  Effect.sync(() => {
    expect(res.status).toBe(status)
  })

describe("POST /api/sessions", () => {
  it("returns 201 and a DTO with viewer_url", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(post(validCreatePayload))
        expect(res.status).toBe(201)
        const dto = yield* _(readJson<SessionDto>(res))
        expect(dto.id).toBe(FIXED_ID)
        expect(dto.status).toBe("READY")
        expect(dto.viewer_url.startsWith(`/b/${FIXED_ID}/vnc.html`)).toBe(true)
        expect(dto.container_id).toBe(FIXED_CONTAINER)
      })
    ))

  it("returns 400 on malformed body", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(post({ ...validCreatePayload, name: "" }))
        expect(res.status).toBe(400)
      })
    ))
})

describe("GET /api/sessions and /api/sessions/:id", () => {
  it("lists previously created sessions", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        yield* _(post(validCreatePayload))
        const res = yield* _(get("/api/sessions"))
        expect(res.status).toBe(200)
        const list = yield* _(readJson<ReadonlyArray<SessionDto>>(res))
        expect(Array.isArray(list)).toBe(true)
        expect(list.length).toBeGreaterThanOrEqual(1)
      })
    ))

  it("returns 404 for an unknown id", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(get("/api/sessions/ffffffffffff"))
        expect(res.status).toBe(404)
        const body = yield* _(readJson<ErrorDto>(res))
        expect(body.error).toBe("session not found")
      })
    ))
})

describe("GET /api/sessions/:id/logs", () => {
  it("returns the docker logs lines", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const created = yield* _(createSession)
        const res = yield* _(get(`/api/sessions/${created.id}/logs`))
        expect(res.status).toBe(200)
        const body = yield* _(readJson<LogsDto>(res))
        expect(body.lines).toEqual(["line1", "line2"])
      })
    ))

  it("returns 404 for unknown session logs", () =>
    Effect.runPromise(Effect.flatMap(get("/api/sessions/ffffffffffff/logs"), (res) => expectStatus(res, 404))))
})

describe("DELETE /api/sessions/:id", () => {
  it("returns 409 when called on a READY session (must stop first)", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const created = yield* _(createSession)
        const res = yield* _(del(`/api/sessions/${created.id}`))
        expect(res.status).toBe(409)
      })
    ))

  it("returns 404 for an unknown id", () =>
    Effect.runPromise(Effect.flatMap(del("/api/sessions/ffffffffffff"), (res) => expectStatus(res, 404))))
})
