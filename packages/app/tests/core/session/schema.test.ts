// CHANGE: tests for the POST /api/sessions schema decoder
// WHY: ТЗ pins the request shape; reject malformed payloads at the boundary
// REF: issue#1 section 8.1
// PURITY: CORE TESTS
// INVARIANT: decode(valid) succeeds; decode(invalid) fails
// COMPLEXITY: O(1)
import { Schema } from "effect"
import { describe, expect, it } from "vitest"

import { CreateSessionRequest } from "../../../src/core/session/schema.js"
import { validCreatePayload } from "../../_fixtures.js"

const valid = validCreatePayload

describe("CreateSessionRequest", () => {
  it("decodes a valid payload", () => {
    expect(() => Schema.decodeUnknownSync(CreateSessionRequest)(valid)).not.toThrow()
  })

  it("rejects empty name", () => {
    expect(() => Schema.decodeUnknownSync(CreateSessionRequest)({ ...valid, name: "" })).toThrow()
  })

  it("rejects name longer than 64 chars", () => {
    expect(() => Schema.decodeUnknownSync(CreateSessionRequest)({ ...valid, name: "a".repeat(65) })).toThrow()
  })

  it("rejects non-positive ttlSeconds", () => {
    expect(() => Schema.decodeUnknownSync(CreateSessionRequest)({ ...valid, ttlSeconds: 0 })).toThrow()
    expect(() => Schema.decodeUnknownSync(CreateSessionRequest)({ ...valid, ttlSeconds: -1 })).toThrow()
  })

  it("rejects non-integer resolution", () => {
    expect(() =>
      Schema.decodeUnknownSync(CreateSessionRequest)({
        ...valid,
        resolution: { ...valid.resolution, width: 1280.5 }
      })
    ).toThrow()
  })

  it("rejects zero cpus", () => {
    expect(() =>
      Schema.decodeUnknownSync(CreateSessionRequest)({ ...valid, resources: { ...valid.resources, cpus: 0 } })
    ).toThrow()
  })
})
