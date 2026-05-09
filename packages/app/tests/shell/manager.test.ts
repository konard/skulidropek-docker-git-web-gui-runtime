// CHANGE: SessionManager integration tests with a fake Docker
// WHY: ТЗ requires create→ready→stop→remove flow; verify FSM + store side effects + docker calls
// REF: issue#1 sections 5, 8, 12
// PURITY: SHELL TESTS
// INVARIANT: every successful create yields READY with containerId; remove drops the session
// COMPLEXITY: O(1) per test
import { Effect, Ref } from "effect"
import { describe, expect, it } from "vitest"

import { SessionId } from "../../src/core/session/types.js"
import { DockerError } from "../../src/shell/services/docker.js"
import {
  InvalidTransition,
  PortExhausted,
  type SessionManager,
  SessionManagerTag
} from "../../src/shell/services/manager.js"
import { FIXED_CONTAINER, FIXED_ID, validCreatePayload } from "../_fixtures.js"
import { buildManagerLayer, type DockerCalls, emptyCalls } from "./_layers.js"

const baseInput = validCreatePayload

const withManager = <A, E>(
  callsRef: Ref.Ref<DockerCalls>,
  body: (m: SessionManager) => Effect.Effect<A, E>,
  ids: ReadonlyArray<string> = [FIXED_ID],
  dockerOverride = {}
) =>
  Effect.provide(
    Effect.gen(function*(_) {
      const m = yield* _(SessionManagerTag)
      return yield* _(body(m))
    }),
    buildManagerLayer(callsRef, ids, dockerOverride)
  )

const runWithCalls = <A, E>(
  body: (m: SessionManager, callsRef: Ref.Ref<DockerCalls>) => Effect.Effect<A, E>,
  ids: ReadonlyArray<string> = [FIXED_ID],
  dockerOverride = {}
) =>
  Effect.runPromise(
    Effect.gen(function*(_) {
      const callsRef = yield* _(Ref.make(emptyCalls))
      const result = yield* _(withManager(callsRef, (m) => body(m, callsRef), ids, dockerOverride))
      const calls = yield* _(Ref.get(callsRef))
      return { calls, result }
    })
  )

const createAndStop = (m: SessionManager) =>
  Effect.gen(function*(_) {
    const c = yield* _(m.create(baseInput))
    yield* _(m.stop(c.id))
    return c
  })

describe("SessionManager.create", () => {
  it("walks CREATED→STARTING→READY and calls docker run once", () =>
    runWithCalls((m) => m.create(baseInput)).then(({ calls, result }) => {
      expect(result.status).toBe("READY")
      expect(result.containerId).toBe(FIXED_CONTAINER)
      expect(result.novncHost).toBe("127.0.0.1")
      expect(result.id).toBe(FIXED_ID)
      expect(calls.run).toHaveLength(1)
      expect(calls.inspectIp).toEqual([FIXED_CONTAINER])
      expect(calls.run[0]?.[0]).toBe("run")
    }))

  it("allocates a port from the configured range", () =>
    runWithCalls((m) => m.create(baseInput)).then(({ result }) => {
      expect(result.novncPort).toBeGreaterThanOrEqual(16_080)
      expect(result.novncPort).toBeLessThanOrEqual(16_999)
    }))
})

describe("SessionManager.list / .get", () => {
  it("returns a created session by id and lists it", () =>
    runWithCalls((m) =>
      Effect.gen(function*(_) {
        const created = yield* _(m.create(baseInput))
        const fetched = yield* _(m.get(created.id))
        const all = yield* _(m.list)
        return { all, created, fetched }
      })
    ).then(({ result }) => {
      expect(result.fetched.id).toBe(result.created.id)
      expect(result.all.map((s) => s.id)).toEqual([result.created.id])
    }))

  it("fails with SessionNotFound for unknown id", () =>
    runWithCalls((m) => m.get(SessionId("ffffffffffff")).pipe(Effect.flip)).then(({ result }) => {
      expect(result._tag).toBe("SessionNotFound")
    }))
})

describe("SessionManager.stop / .remove / .logs", () => {
  it("drives stop → STOPPING → STOPPED and calls docker stop", () =>
    runWithCalls((m) =>
      Effect.gen(function*(_) {
        const c = yield* _(m.create(baseInput))
        return yield* _(m.stop(c.id))
      })
    ).then(({ calls, result }) => {
      expect(result.status).toBe("STOPPED")
      expect(calls.stop).toEqual([FIXED_CONTAINER])
    }))

  it("removes the session from the store after Delete and calls docker rm", () =>
    runWithCalls((m) =>
      Effect.gen(function*(_) {
        const c = yield* _(createAndStop(m))
        const removed = yield* _(m.remove(c.id))
        const lookup = yield* _(m.get(c.id).pipe(Effect.flip))
        return { lookupTag: lookup._tag, removed }
      })
    ).then(({ calls, result }) => {
      expect(result.removed.status).toBe("DELETED")
      expect(result.lookupTag).toBe("SessionNotFound")
      expect(calls.rm).toEqual([FIXED_CONTAINER])
    }))

  it("returns the docker logs for the session", () =>
    runWithCalls((m) =>
      Effect.gen(function*(_) {
        const c = yield* _(m.create(baseInput))
        return yield* _(m.logs(c.id))
      })
    ).then(({ calls, result }) => {
      expect(result).toEqual(["line1", "line2"])
      expect(calls.logs).toEqual([FIXED_CONTAINER])
    }))
})

describe("SessionManager error paths", () => {
  it("propagates DockerError when docker run fails", () =>
    runWithCalls(
      (m) => m.create(baseInput).pipe(Effect.flip),
      [FIXED_ID],
      { run: () => Effect.fail(new DockerError({ stage: "run", cause: "boom" })) }
    ).then(({ result }) => {
      expect(result._tag).toBe("DockerError")
    }))

  it("rejects re-stopping a STOPPED session via InvalidTransition", () =>
    runWithCalls((m) =>
      Effect.gen(function*(_) {
        const c = yield* _(createAndStop(m))
        return yield* _(m.stop(c.id).pipe(Effect.flip))
      })
    ).then(({ result }) => {
      expect(result).toBeInstanceOf(InvalidTransition)
    }))

  it("PortExhausted carries the configured range", () => {
    const e = new PortExhausted({ min: 1, max: 2 })
    expect(e.min).toBe(1)
    expect(e.max).toBe(2)
  })
})
