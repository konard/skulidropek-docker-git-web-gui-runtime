// CHANGE: helpers shared between manager-create.ts and manager-ops.ts
// WHY: per-op modules need the same FSM transition + docker no-op helpers; centralize to avoid duplication
// QUOTE(TZ): "FSM ... Stop, MarkStopped, Delete"
// REF: issue#1 sections 5, 11
// PURITY: SHELL
// EFFECT: Effect<*, InvalidTransition | DockerError, never>
// INVARIANT: transition only writes when applyTransition returns Accept
// COMPLEXITY: O(1)/O(1)
import { Effect } from "effect"

import { applyTransition, type SessionEvent } from "../../core/session/transitions.js"
import type { Session } from "../../core/session/types.js"
import type { Docker, DockerError } from "./docker.js"
import type { ClockDep } from "./manager-deps.js"
import { InvalidTransition } from "./manager.js"
import type { SessionStore } from "./store.js"

interface TransitionDeps {
  readonly store: Pick<SessionStore, "put">
  readonly clock: ClockDep
}

export const transitionAndStore = (
  deps: TransitionDeps,
  session: Session,
  event: SessionEvent
): Effect.Effect<Session, InvalidTransition> =>
  deps.clock.now.pipe(Effect.flatMap((now) => {
    const result = applyTransition(session, event, now)
    if (result._tag === "Reject" || result.session === undefined) {
      return Effect.fail(
        new InvalidTransition({
          id: session.id,
          reason: result._tag === "Reject" ? result.reason : "missing session"
        })
      )
    }
    return Effect.as(deps.store.put(result.session), result.session)
  }))

export const dockerCall = (
  docker: Pick<Docker, "stop" | "rm">,
  session: Session,
  op: "stop" | "rm"
): Effect.Effect<void, DockerError> => {
  if (session.containerId === null) return Effect.void
  return op === "stop" ? docker.stop(session.containerId) : docker.rm(session.containerId)
}
