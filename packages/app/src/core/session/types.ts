// CHANGE: introduce pure session domain types
// WHY: every layer above must reference a single typed model of a Web-X11 session
// QUOTE(TZ): "Сессия должна иметь конечный автомат состояний: CREATED → STARTING → READY → STOPPING / FAILED → STOPPED → DELETED"
// REF: issue#1 section 5
// SOURCE: n/a
// FORMAT THEOREM: ∀ session ∈ Sessions: status(session) ∈ SessionStatus
// PURITY: CORE
// INVARIANT: SessionId is a non-empty hex-like identifier; transitions are total
// COMPLEXITY: O(1)/O(1)
import { Brand } from "effect"

/**
 * Branded session identifier, hex-like, length 12..64.
 *
 * @invariant SessionId.value matches /^[a-z0-9]{12,64}$/
 */
export type SessionId = string & Brand.Brand<"SessionId">

/**
 * Branded container identifier returned by the docker engine.
 */
export type ContainerId = string & Brand.Brand<"ContainerId">

/**
 * Possible session statuses (finite state machine).
 *
 * @invariant ∀ s: nextStatus(s, event) ∈ SessionStatus
 */
export type SessionStatus =
  | "CREATED"
  | "STARTING"
  | "READY"
  | "STOPPING"
  | "STOPPED"
  | "FAILED"
  | "DELETED"

/** Resolution of the virtual X11 display. */
export interface Resolution {
  readonly width: number
  readonly height: number
  readonly depth: number
}

/** Container resource limits. */
export interface Resources {
  readonly cpus: number
  readonly memoryMb: number
  readonly shmMb: number
}

/**
 * Immutable session record.
 *
 * @invariant ttlSeconds > 0
 * @invariant resolution.{width,height,depth} > 0
 * @invariant resources.{cpus,memoryMb,shmMb} > 0
 */
export interface Session {
  readonly id: SessionId
  readonly name: string
  readonly image: string
  readonly app: string
  readonly status: SessionStatus
  readonly containerId: ContainerId | null
  readonly novncPort: number
  readonly resolution: Resolution
  readonly resources: Resources
  readonly ttlSeconds: number
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly expiresAt: Date
  readonly stoppedAt: Date | null
  readonly failureReason: string | null
}

/** Smart constructor: brand a string as SessionId. */
export const SessionId = Brand.refined<SessionId>(
  (raw) => /^[a-z0-9]{12,64}$/.test(raw),
  (raw) => Brand.error(`SessionId must match /^[a-z0-9]{12,64}$/, got "${raw}"`)
)

/** Smart constructor: brand a string as ContainerId. */
export const ContainerId = Brand.refined<ContainerId>(
  (raw) => raw.length >= 12,
  (raw) => Brand.error(`ContainerId must be at least 12 chars, got "${raw}"`)
)
