// CHANGE: tests for the Session → DTO adapter
// WHY: ТЗ pins the JSON shape; ensure snake_case names and ISO timestamps
// REF: issue#1 section 8.2
// PURITY: CORE TESTS
// INVARIANT: viewer_url === viewerUrl(id) ∧ all *_at fields are ISO 8601
// COMPLEXITY: O(1)
import { describe, expect, it } from "vitest"

import { toDto } from "../../../src/core/session/dto.js"
import type { Session } from "../../../src/core/session/types.js"
import { ContainerId, SessionId } from "../../../src/core/session/types.js"
import { makeSessionFixture } from "../../_fixtures.js"

const session: Session = makeSessionFixture({
  id: SessionId("4b618726aef0"),
  containerId: ContainerId("abcdef012345"),
  updatedAt: new Date("2025-05-09T12:00:30.000Z")
})

describe("toDto", () => {
  it("emits snake_case keys per the spec", () => {
    const dto = toDto(session)
    expect(dto).toHaveProperty("viewer_url")
    expect(dto).toHaveProperty("novnc_port")
    expect(dto).toHaveProperty("container_id")
    expect(dto).toHaveProperty("created_at")
    expect(dto).toHaveProperty("updated_at")
    expect(dto).toHaveProperty("expires_at")
    expect(dto).toHaveProperty("stopped_at")
    expect(dto).toHaveProperty("failure_reason")
  })

  it("converts Date fields to ISO strings", () => {
    const dto = toDto(session)
    expect(dto.created_at).toBe("2025-05-09T12:00:00.000Z")
    expect(dto.updated_at).toBe("2025-05-09T12:00:30.000Z")
    expect(dto.expires_at).toBe("2025-05-09T13:00:00.000Z")
  })

  it("renders stopped_at as null when not set, ISO string when set", () => {
    expect(toDto(session).stopped_at).toBeNull()
    const stopped: Session = { ...session, stoppedAt: new Date("2025-05-09T12:30:00.000Z") }
    expect(toDto(stopped).stopped_at).toBe("2025-05-09T12:30:00.000Z")
  })

  it("renders container_id as null when no container is attached", () => {
    const dto = toDto({ ...session, containerId: null })
    expect(dto.container_id).toBeNull()
  })

  it("emits a viewer_url that targets the gateway path", () => {
    const dto = toDto(session)
    expect(dto.viewer_url.startsWith(`/b/${session.id}/vnc.html`)).toBe(true)
  })

  it("preserves failure_reason verbatim", () => {
    const dto = toDto({ ...session, failureReason: "boom" })
    expect(dto.failure_reason).toBe("boom")
  })
})
