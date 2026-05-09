// CHANGE: Ref-based session store
// WHY: MVP needs a single-process source of truth; persistence is a documented next step
// QUOTE(TZ): "DB: SQLite для MVP" / "Stage 2: несколько Docker worker-нод"
// REF: issue#1 sections 4.1, 13.2
// PURITY: SHELL
// EFFECT: Effect<*, never | NotFound, SessionStore>
// INVARIANT: store keeps a HashMap<SessionId, Session>; reads return immutable snapshots
// COMPLEXITY: O(1)/O(n) for list
import { Context, Data, Effect, HashMap, Layer, Option, Ref } from "effect"

import type { Session, SessionId } from "../../core/session/types.js"

export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  readonly id: SessionId
}> {}

export interface SessionStore {
  readonly put: (session: Session) => Effect.Effect<void>
  readonly get: (id: SessionId) => Effect.Effect<Session, SessionNotFound>
  readonly list: Effect.Effect<ReadonlyArray<Session>>
  readonly remove: (id: SessionId) => Effect.Effect<void>
  readonly usedPorts: Effect.Effect<ReadonlySet<number>>
}

export class SessionStoreTag extends Context.Tag("webx11/SessionStore")<
  SessionStoreTag,
  SessionStore
>() {}

const makeStore = Effect.gen(function*(_) {
  const ref = yield* _(Ref.make(HashMap.empty<SessionId, Session>()))
  return {
    put: (session: Session) => Ref.update(ref, (m) => HashMap.set(m, session.id, session)),
    get: (id: SessionId) =>
      Effect.flatMap(Ref.get(ref), (m) =>
        Option.match(HashMap.get(m, id), {
          onNone: () => Effect.fail(new SessionNotFound({ id })),
          onSome: (s) => Effect.succeed(s)
        })),
    list: Effect.map(Ref.get(ref), (m) => [...HashMap.values(m)]),
    remove: (id: SessionId) => Ref.update(ref, (m) => HashMap.remove(m, id)),
    usedPorts: Effect.map(
      Ref.get(ref),
      (m) => new Set([...HashMap.values(m)].map((s) => s.novncPort))
    )
  } satisfies SessionStore
})

export const SessionStoreLayer = Layer.effect(SessionStoreTag, makeStore)
