// CHANGE: tests for the /b/<session_id>/<rest> path parser
// WHY: gateway routing decisions depend on this; cover happy path and rejected inputs
// REF: issue#1 section 9
// PURITY: CORE TESTS
// INVARIANT: parseGatewayPath ∘ formatGatewayPath = id (for valid routes)
// COMPLEXITY: O(|path|)
import { Option } from "effect"
import { describe, expect, it } from "vitest"

import { formatGatewayPath, parseGatewayPath } from "../../../src/core/gateway/path.js"
import { SessionId } from "../../../src/core/session/types.js"

const id = SessionId("4b618726aef0")

describe("parseGatewayPath", () => {
  it("parses /b/<id>/vnc.html → { id, subPath: 'vnc.html' }", () => {
    const r = parseGatewayPath(`/b/${id}/vnc.html`)
    expect(Option.isSome(r)).toBe(true)
    if (Option.isSome(r)) {
      expect(r.value.sessionId).toBe(id)
      expect(r.value.subPath).toBe("vnc.html")
    }
  })

  it.each([
    [`/b/${id}/`, ""],
    [`/b/${id}`, ""]
  ])("parses %s → subPath '%s'", (path, expected) => {
    const r = parseGatewayPath(path)
    expect(Option.isSome(r)).toBe(true)
    if (Option.isSome(r)) expect(r.value.subPath).toBe(expected)
  })

  it("preserves nested subpaths verbatim", () => {
    const r = parseGatewayPath(`/b/${id}/static/img/icon.png`)
    if (Option.isSome(r)) expect(r.value.subPath).toBe("static/img/icon.png")
  })

  it("returns None for paths that don't start with /b/", () => {
    expect(Option.isNone(parseGatewayPath("/api/sessions"))).toBe(true)
    expect(Option.isNone(parseGatewayPath("/"))).toBe(true)
    expect(Option.isNone(parseGatewayPath(""))).toBe(true)
  })

  it("returns None when the id segment is invalid", () => {
    expect(Option.isNone(parseGatewayPath("/b/INVALID/vnc.html"))).toBe(true)
    expect(Option.isNone(parseGatewayPath("/b/short/vnc.html"))).toBe(true)
  })
})

describe("formatGatewayPath", () => {
  it("renders trailing slash for empty subPath", () => {
    expect(formatGatewayPath({ sessionId: id, subPath: "" })).toBe(`/b/${id}/`)
  })

  it("appends a non-empty subPath without inserting a duplicate slash", () => {
    expect(formatGatewayPath({ sessionId: id, subPath: "vnc.html" })).toBe(`/b/${id}/vnc.html`)
  })

  it("round-trips with parseGatewayPath for non-empty subPath", () => {
    const route = { sessionId: id, subPath: "vnc.html" }
    const r = parseGatewayPath(formatGatewayPath(route))
    expect(Option.isSome(r)).toBe(true)
    if (Option.isSome(r)) expect(r.value).toEqual(route)
  })
})
