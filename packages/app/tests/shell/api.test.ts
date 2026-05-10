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

interface WorkspaceListDto {
  readonly workspaces: ReadonlyArray<{
    readonly id: string
    readonly availability: string
    readonly launch_status: string
    readonly launch_surface: string
    readonly launch_url: string
    readonly kasm: { readonly friendlyName: string; readonly dockerImage: string } | null
  }>
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

const postPath = (path: string) =>
  Effect.promise(() => app.handler(new Request(`https://t${path}`, { method: "POST" })))

const postWorkspace = (id: string, body: object) =>
  Effect.promise(() =>
    app.handler(
      new Request(`https://t/api/workspaces/${id}/sessions`, {
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

const expectReadyCreated = (res: Response): Effect.Effect<SessionDto> =>
  Effect.gen(function*(_) {
    expect(res.status).toBe(201)
    const dto = yield* _(readJson<SessionDto>(res))
    expect(dto.id).toBe(FIXED_ID)
    expect(dto.status).toBe("READY")
    return dto
  })

const expectStatus = (res: Response, status: number): Effect.Effect<void> =>
  Effect.sync(() => {
    expect(res.status).toBe(status)
  })

describe("POST /api/sessions", () => {
  it("returns 201 and a DTO with viewer_url", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(post(validCreatePayload))
        const dto = yield* _(expectReadyCreated(res))
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

describe("GET /api/workspaces", () => {
  it("returns selectable workspace settings", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(get("/api/workspaces"))
        expect(res.status).toBe(200)
        const body = yield* _(readJson<WorkspaceListDto>(res))
        const ids = body.workspaces.map((workspace) => workspace.id)
        expect(ids).toContain("visual-studio-code")
        expect(ids).toContain("android-redroid")
        expect(ids).toContain("windows-vm-create")
        const android = body.workspaces.find((workspace) => workspace.id === "android-redroid")
        expect(android?.launch_surface).toBe("kasm-ui")
        expect(android?.kasm?.dockerImage).toBe("kasmweb/redroid:1.18.0")
      })
    ))

  it("returns one workspace by id", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(get("/api/workspaces/windows-remoteapp"))
        expect(res.status).toBe(200)
        const body = yield* _(
          readJson<{ readonly availability: string; readonly launch_surface: string; readonly launch_url: string }>(res)
        )
        expect(body.availability).toBe("requires-setup")
        expect(body.launch_surface).toBe("external")
        expect(body.launch_url).toBe("/api/workspaces/windows-remoteapp/sessions")
      })
    ))
})

describe("POST /api/workspaces/:id/sessions", () => {
  it("launches a Web-X11 preset", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(postWorkspace("xeyes", { name: "eyes" }))
        yield* _(expectReadyCreated(res))
      })
    ))

  it("returns setup requirements for Windows VM strategy", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const res = yield* _(postWorkspace("windows-vm-create", {}))
        expect(res.status).toBe(501)
        const body = yield* _(readJson<ErrorDto & { readonly launch_surface: string }>(res))
        expect(body.error).toBe("workspace requires setup before launch")
        expect(body.launch_surface).toBe("external")
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
  it("allows stop before delete", () =>
    Effect.runPromise(
      Effect.gen(function*(_) {
        const created = yield* _(createSession)
        const stopped = yield* _(postPath(`/api/sessions/${created.id}/stop`))
        expect(stopped.status).toBe(200)
        const stoppedDto = yield* _(readJson<SessionDto>(stopped))
        expect(stoppedDto.status).toBe("STOPPED")
        const removed = yield* _(del(`/api/sessions/${created.id}`))
        expect(removed.status).toBe(200)
        const removedDto = yield* _(readJson<SessionDto>(removed))
        expect(removedDto.status).toBe("DELETED")
      })
    ))

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
