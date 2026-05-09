// CHANGE: SessionManager service Tag, error types and Layer assembly
// WHY: orchestrate create/start/stop/delete/logs by delegating to per-op modules (≤50 LOC each)
// QUOTE(TZ): "POST /api/sessions ... { id, status: STARTING, viewer_url }"
// REF: issue#1 sections 8, 12
// PURITY: SHELL
// EFFECT: Effect<*, ManagerError | SessionNotFound, SessionManager>
// INVARIANT: every successful create() ends with a Session in status READY
// COMPLEXITY: O(1)/O(1) per call (allocator dominates)
import { Context, Data, Effect, Layer } from "effect"

import type { CreateSessionInput } from "../../core/session/factory.js"
import type { Session, SessionId } from "../../core/session/types.js"
import { NowClock } from "./clock.js"
import type { DockerError } from "./docker.js"
import { DockerTag } from "./docker.js"
import { IdGen } from "./id.js"
import { createOp } from "./manager-create.js"
import { logsOp, removeOp, stopOp } from "./manager-ops.js"
import type { SessionNotFound } from "./store.js"
import { SessionStoreTag } from "./store.js"

export class PortExhausted extends Data.TaggedError("PortExhausted")<{
  readonly min: number
  readonly max: number
}> {}

export class InvalidTransition extends Data.TaggedError("InvalidTransition")<{
  readonly id: SessionId
  readonly reason: string
}> {}

export type ManagerError = PortExhausted | InvalidTransition | DockerError

export interface SessionManager {
  readonly create: (input: CreateSessionInput) => Effect.Effect<Session, ManagerError>
  readonly get: (id: SessionId) => Effect.Effect<Session, SessionNotFound>
  readonly list: Effect.Effect<ReadonlyArray<Session>>
  readonly stop: (id: SessionId) => Effect.Effect<Session, SessionNotFound | ManagerError>
  readonly remove: (id: SessionId) => Effect.Effect<Session, SessionNotFound | ManagerError>
  readonly logs: (id: SessionId) => Effect.Effect<ReadonlyArray<string>, SessionNotFound | DockerError>
}

export class SessionManagerTag extends Context.Tag("webx11/SessionManager")<
  SessionManagerTag,
  SessionManager
>() {}

export const SessionManagerLayer = Layer.effect(
  SessionManagerTag,
  Effect.gen(function*(_) {
    const store = yield* _(SessionStoreTag)
    const docker = yield* _(DockerTag)
    const ids = yield* _(IdGen)
    const clock = yield* _(NowClock)
    return {
      create: (input) => createOp({ store, docker, ids, clock }, input),
      get: store.get,
      list: store.list,
      stop: (id) => stopOp({ store, docker, clock }, id),
      remove: (id) => removeOp({ store, docker, clock }, id),
      logs: (id) => logsOp({ store, docker }, id)
    } satisfies SessionManager
  })
)
