// CHANGE: shared dependency shapes used by the manager-* op modules
// WHY: keep typing of (store, docker, ids, clock) tuple in one place to avoid drift
// QUOTE(TZ): "Session Manager: создаёт ... запускает контейнер ... останавливает / удаляет"
// REF: issue#1 sections 4.1, 8
// PURITY: SHELL
// EFFECT: type-only module
// INVARIANT: every Deps* type is a subset of the full SessionManager dependencies
// COMPLEXITY: O(1)/O(1)
import type { Effect } from "effect"

import type { SessionId } from "../../core/session/types.js"
import type { Docker } from "./docker.js"
import type { SessionStore } from "./store.js"

/** Read-only clock: returns the current instant as a JavaScript Date. */
export interface ClockDep {
  readonly now: Effect.Effect<Date>
}

/** Random-id generator dep: yields a fresh branded SessionId. */
export interface IdGenDep {
  readonly newSessionId: Effect.Effect<SessionId>
}

/** Dependencies needed to create a brand new session. */
export interface CreateDeps {
  readonly store: SessionStore
  readonly docker: Docker
  readonly ids: IdGenDep
  readonly clock: ClockDep
}

/** Dependencies for stop/remove operations. */
export interface MutateDeps {
  readonly store: SessionStore
  readonly docker: Docker
  readonly clock: ClockDep
}

/** Dependencies for log retrieval. */
export interface LogsDeps {
  readonly store: SessionStore
  readonly docker: Docker
}
