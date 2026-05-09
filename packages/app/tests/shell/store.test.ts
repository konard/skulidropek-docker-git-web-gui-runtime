// CHANGE: SessionStore behavior tests (put/get/list/remove/usedPorts)
// WHY: store is the source of truth for the SHELL; verify HashMap semantics + NotFound
// REF: issue#1 sections 4.1, 13.2
// PURITY: SHELL TESTS
// INVARIANT: get(unknown) → SessionNotFound; usedPorts mirrors live novncPort set
// COMPLEXITY: O(1) per test
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import type { Session } from "../../src/core/session/types.js"
import { SessionId } from "../../src/core/session/types.js"
import { type SessionStore, SessionStoreLayer, SessionStoreTag } from "../../src/shell/services/store.js"
import { makeSessionFixture } from "../_fixtures.js"

const makeSession = (id: string, port: number): Session => makeSessionFixture({ id: SessionId(id), novncPort: port })

const a = makeSession("aaaaaaaaaaaa", 16_080)
const b = makeSession("bbbbbbbbbbbb", 16_081)

const withStore = <A, E>(body: (s: SessionStore) => Effect.Effect<A, E, SessionStoreTag>) =>
  Effect.runPromise(Effect.provide(
    Effect.gen(function*(_) {
      const s = yield* _(SessionStoreTag)
      return yield* _(body(s))
    }),
    SessionStoreLayer
  ))

const withStorePrefilled = <A, E>(
  sessions: ReadonlyArray<Session>,
  body: (s: SessionStore) => Effect.Effect<A, E, SessionStoreTag>
) =>
  withStore((s) =>
    Effect.gen(function*(_) {
      for (const sess of sessions) yield* _(s.put(sess))
      return yield* _(body(s))
    })
  )

describe("SessionStore", () => {
  it("put/get round-trips a session", () =>
    withStore((s) =>
      Effect.gen(function*(_) {
        yield* _(s.put(a))
        const got = yield* _(s.get(a.id))
        expect(got.id).toBe(a.id)
        expect(got.novncPort).toBe(16_080)
      })
    ))

  it("get fails with SessionNotFound for unknown id", () =>
    withStore((s) =>
      Effect.gen(function*(_) {
        const err = yield* _(s.get(SessionId("ffffffffffff")).pipe(Effect.flip))
        expect(err._tag).toBe("SessionNotFound")
        expect(err.id).toBe("ffffffffffff")
      })
    ))

  it("list returns all sessions inserted", () =>
    withStorePrefilled([a, b], (s) =>
      Effect.gen(function*(_) {
        const all = yield* _(s.list)
        const ids = new Set(all.map((x) => x.id))
        expect(ids).toEqual(new Set([a.id, b.id]))
      })))

  it("remove drops a session and subsequent get fails", () =>
    withStore((s) =>
      Effect.gen(function*(_) {
        yield* _(s.put(a))
        yield* _(s.remove(a.id))
        const out = yield* _(s.get(a.id).pipe(Effect.flip))
        expect(out._tag).toBe("SessionNotFound")
      })
    ))

  it("usedPorts reflects the live set of novncPort values", () =>
    withStorePrefilled([a, b], (s) =>
      Effect.gen(function*(_) {
        const ports = yield* _(s.usedPorts)
        expect(ports.has(16_080)).toBe(true)
        expect(ports.has(16_081)).toBe(true)
        expect(ports.size).toBe(2)
      })))

  it("put overwrites an existing session with the same id", () =>
    withStore((s) =>
      Effect.gen(function*(_) {
        yield* _(s.put(a))
        yield* _(s.put({ ...a, status: "STOPPED" }))
        const got = yield* _(s.get(a.id))
        expect(got.status).toBe("STOPPED")
      })
    ))
})
