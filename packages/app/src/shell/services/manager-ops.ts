// CHANGE: stop/remove/logs ops for the session manager
// WHY: keep manager.ts ≤300 LOC and isolate the docker stop/rm/logs calls behind small functions
// QUOTE(TZ): "DELETE /api/sessions/{id} ... останавливает и удаляет контейнер / GET ... /logs"
// REF: issue#1 sections 8.4, 8.5
// PURITY: SHELL
// EFFECT: Effect<*, ManagerError | SessionNotFound | DockerError, never>
// INVARIANT: stop drives FSM to STOPPED; remove drives to DELETED and removes from store
// COMPLEXITY: O(1)/O(1)
import { Effect } from "effect"

import type { Session, SessionId } from "../../core/session/types.js"
import type { DockerError } from "./docker.js"
import type { LogsDeps, MutateDeps } from "./manager-deps.js"
import { dockerCall, transitionAndStore } from "./manager-shared.js"
import { type ManagerError } from "./manager.js"
import type { SessionNotFound } from "./store.js"

type MutateResult = Effect.Effect<Session, SessionNotFound | ManagerError>

export const stopOp = (deps: MutateDeps, id: SessionId): MutateResult =>
  Effect.gen(function*(_) {
    const session = yield* _(deps.store.get(id))
    const stopping = yield* _(transitionAndStore(deps, session, { _tag: "Stop" }))
    yield* _(dockerCall(deps.docker, stopping, "stop"))
    const now = yield* _(deps.clock.now)
    return yield* _(transitionAndStore(deps, stopping, { _tag: "MarkStopped", at: now }))
  })

export const removeOp = (deps: MutateDeps, id: SessionId): MutateResult =>
  deps.store.get(id).pipe(
    Effect.flatMap((session) =>
      dockerCall(deps.docker, session, "rm").pipe(
        Effect.zipRight(transitionAndStore(deps, session, { _tag: "Delete" })),
        Effect.tap(() => deps.store.remove(id))
      )
    )
  )

export const logsOp = (
  deps: LogsDeps,
  id: SessionId
): Effect.Effect<ReadonlyArray<string>, SessionNotFound | DockerError> =>
  deps.store.get(id).pipe(Effect.flatMap((session) =>
    session.containerId === null
      ? Effect.succeed<ReadonlyArray<string>>([])
      : deps.docker.logs(session.containerId)
  ))
