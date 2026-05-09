// CHANGE: pure state-machine transitions for sessions
// WHY: keep status changes total and reviewable in one place
// QUOTE(TZ): "Сессия должна иметь конечный автомат состояний"
// REF: issue#1 section 5
// PURITY: CORE
// INVARIANT: every (status, event) pair maps to either Ok(next) or Reject(reason)
// COMPLEXITY: O(1)/O(1)
import { Match } from "effect"

import type { Session, SessionStatus } from "./types.js"

/** All transition events the session manager exposes. */
export type SessionEvent =
  | { readonly _tag: "Start" }
  | { readonly _tag: "MarkReady" }
  | { readonly _tag: "Stop" }
  | { readonly _tag: "MarkStopped"; readonly at: Date }
  | { readonly _tag: "Fail"; readonly reason: string }
  | { readonly _tag: "Delete" }

/** Result of a transition: either a new status or an explanation why it was refused. */
export type TransitionResult =
  | { readonly _tag: "Ok"; readonly next: SessionStatus }
  | { readonly _tag: "Reject"; readonly reason: string }

const ok = (next: SessionStatus): TransitionResult => ({ _tag: "Ok", next })
const reject = (reason: string): TransitionResult => ({
  _tag: "Reject",
  reason
})

/**
 * Compute next status for a (status, event) pair without producing side effects.
 *
 * @invariant ∀ s, e: nextStatus(s, e)._tag ∈ {"Ok", "Reject"}
 * @complexity O(1)
 */
export const nextStatus = (
  status: SessionStatus,
  event: SessionEvent
): TransitionResult =>
  Match.value(event).pipe(
    Match.when({ _tag: "Start" }, () => status === "CREATED" ? ok("STARTING") : reject(`Start invalid in ${status}`)),
    Match.when({ _tag: "MarkReady" }, () =>
      status === "STARTING" ? ok("READY") : reject(`MarkReady invalid in ${status}`)),
    Match.when({ _tag: "Stop" }, () =>
      status === "STARTING" || status === "READY"
        ? ok("STOPPING")
        : reject(`Stop invalid in ${status}`)),
    Match.when({ _tag: "MarkStopped" }, () =>
      status === "STOPPING" ? ok("STOPPED") : reject(`MarkStopped invalid in ${status}`)),
    Match.when({ _tag: "Fail" }, () =>
      status === "DELETED"
        ? reject("Fail invalid after DELETED")
        : ok("FAILED")),
    Match.when({ _tag: "Delete" }, () =>
      status === "STOPPED" || status === "FAILED" || status === "CREATED"
        ? ok("DELETED")
        : reject(`Delete invalid in ${status}`)),
    Match.exhaustive
  )

const withStoppedAt = (
  session: Session,
  event: SessionEvent,
  next: SessionStatus,
  now: Date
): Session => {
  const stoppedAt = next === "STOPPED" && event._tag === "MarkStopped" ? event.at : session.stoppedAt
  const failureReason = event._tag === "Fail" ? event.reason : session.failureReason
  return { ...session, status: next, updatedAt: now, stoppedAt, failureReason }
}

/**
 * Apply a transition to an immutable session record.
 *
 * @returns Session with updated status, updatedAt, and (when relevant) stoppedAt/failureReason.
 * @invariant input.id === output.id
 * @complexity O(1)
 */
export const applyTransition = (
  session: Session,
  event: SessionEvent,
  now: Date
): TransitionResult & { readonly session?: Session } => {
  const result = nextStatus(session.status, event)
  return Match.value(result).pipe(
    Match.when({ _tag: "Ok" }, ({ next }) => ({
      _tag: "Ok" as const,
      next,
      session: withStoppedAt(session, event, next, now)
    })),
    Match.when({ _tag: "Reject" }, (r) => r),
    Match.exhaustive
  )
}
