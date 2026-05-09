// CHANGE: pure constructor that produces an initial CREATED session record
// WHY: keep validation and defaults in CORE; SHELL only supplies the timestamp + id + port
// QUOTE(TZ): "POST /api/sessions ... { id, status: STARTING, viewer_url }"
// REF: issue#1 section 8.1
// PURITY: CORE
// INVARIANT: createSession returns a session in status CREATED with consistent timestamps
// COMPLEXITY: O(1)/O(1)
import type { Resolution, Resources, Session, SessionId } from "./types.js"

/** Inputs accepted by POST /api/sessions, after schema decoding. */
export interface CreateSessionInput {
  readonly name: string
  readonly image: string
  readonly app: string
  readonly resolution: Resolution
  readonly resources: Resources
  readonly ttlSeconds: number
}

/** Required environment supplied by the SHELL: deterministic time + chosen id + port. */
export interface CreateSessionContext {
  readonly id: SessionId
  readonly novncPort: number
  readonly now: Date
}

/**
 * Build the initial CREATED session record from validated input + shell context.
 *
 * @invariant output.status === "CREATED" ∧ output.expiresAt − output.createdAt = ttlSeconds·1000ms
 * @complexity O(1)
 */
export const createSession = (
  input: CreateSessionInput,
  ctx: CreateSessionContext
): Session => ({
  id: ctx.id,
  name: input.name,
  image: input.image,
  app: input.app,
  status: "CREATED",
  containerId: null,
  novncPort: ctx.novncPort,
  resolution: input.resolution,
  resources: input.resources,
  ttlSeconds: input.ttlSeconds,
  createdAt: ctx.now,
  updatedAt: ctx.now,
  expiresAt: new Date(ctx.now.getTime() + input.ttlSeconds * 1000),
  stoppedAt: null,
  failureReason: null
})
