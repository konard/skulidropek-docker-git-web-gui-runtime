// CHANGE: tests for the pure createSession factory
// WHY: every Session in the system flows through this constructor; verify defaults and time arithmetic
// REF: issue#1 section 8.1
// PURITY: CORE TESTS
// INVARIANT: status === "CREATED" ∧ expiresAt − createdAt === ttlSeconds·1000
// COMPLEXITY: O(1)
import { describe, expect, it } from "vitest"

import { createSession } from "../../../src/core/session/factory.js"
import { SessionId } from "../../../src/core/session/types.js"
import { validCreatePayload } from "../../_fixtures.js"

const ctx = {
  id: SessionId("4b618726aef0"),
  novncPort: 16_080,
  now: new Date("2025-05-09T12:00:00.000Z")
}

const input = validCreatePayload

describe("createSession", () => {
  it("returns a CREATED session with no container", () => {
    const s = createSession(input, ctx)
    expect(s.status).toBe("CREATED")
    expect(s.containerId).toBeNull()
  })

  it("copies through input fields verbatim", () => {
    const s = createSession(input, ctx)
    expect(s.name).toBe(input.name)
    expect(s.image).toBe(input.image)
    expect(s.app).toBe(input.app)
    expect(s.resolution).toEqual(input.resolution)
    expect(s.resources).toEqual(input.resources)
    expect(s.ttlSeconds).toBe(input.ttlSeconds)
  })

  it("uses ctx.now for createdAt and updatedAt and computes expiresAt = now + ttl", () => {
    const s = createSession(input, ctx)
    expect(s.createdAt).toEqual(ctx.now)
    expect(s.updatedAt).toEqual(ctx.now)
    expect(s.expiresAt.getTime() - ctx.now.getTime()).toBe(input.ttlSeconds * 1000)
  })

  it("starts with stoppedAt = null and failureReason = null", () => {
    const s = createSession(input, ctx)
    expect(s.stoppedAt).toBeNull()
    expect(s.failureReason).toBeNull()
  })

  it("forwards the supplied id and port", () => {
    const s = createSession(input, ctx)
    expect(s.id).toBe(ctx.id)
    expect(s.novncPort).toBe(ctx.novncPort)
  })
})
