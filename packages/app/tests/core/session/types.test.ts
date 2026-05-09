// CHANGE: unit tests for branded SessionId / ContainerId smart constructors
// WHY: every layer above relies on these refinements as the only id source of truth
// REF: issue#1 section 5
// PURITY: CORE TESTS
// INVARIANT: Brand.either rejects malformed input, accepts canonical input
// COMPLEXITY: O(|cases|)
import { describe, expect, it } from "vitest"

import { ContainerId, type SessionId, SessionId as SessionIdBrand } from "../../../src/core/session/types.js"

describe("SessionId smart constructor", () => {
  it("accepts a 12-char hex-like id", () => {
    const result = SessionIdBrand.either("4b618726aef0")
    expect(result._tag).toBe("Right")
  })

  it("accepts a 64-char hex-like id at the upper bound", () => {
    const result = SessionIdBrand.either("a".repeat(64))
    expect(result._tag).toBe("Right")
  })

  it("rejects an id shorter than 12 chars", () => {
    const result = SessionIdBrand.either("abc")
    expect(result._tag).toBe("Left")
  })

  it("rejects an id longer than 64 chars", () => {
    const result = SessionIdBrand.either("a".repeat(65))
    expect(result._tag).toBe("Left")
  })

  it("rejects an id with uppercase letters", () => {
    const result = SessionIdBrand.either("ABCDEF012345")
    expect(result._tag).toBe("Left")
  })

  it("rejects an id with non-hex characters", () => {
    const result = SessionIdBrand.either("hello-world1")
    expect(result._tag).toBe("Left")
  })

  it("returns a plain string at runtime that retains the brand at the type level", () => {
    const id: SessionId = SessionIdBrand("4b618726aef0")
    expect(id).toBe("4b618726aef0")
  })
})

describe("ContainerId smart constructor", () => {
  it("accepts a 12-char container id", () => {
    expect(ContainerId.either("abcdef012345")._tag).toBe("Right")
  })

  it("rejects a too-short container id", () => {
    expect(ContainerId.either("short")._tag).toBe("Left")
  })
})
