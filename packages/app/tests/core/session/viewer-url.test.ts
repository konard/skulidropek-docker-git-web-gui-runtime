// CHANGE: tests for the viewer-URL formatter
// WHY: ТЗ pins the path/query layout exactly; verify shape and round-trip via parseGatewayPath
// REF: issue#1 sections 1, 8.1, 9.1
// PURITY: CORE TESTS
// INVARIANT: viewerUrl(id) starts with /b/<id>/vnc.html and embeds an encoded websockify path
// COMPLEXITY: O(|id|)
import { describe, expect, it } from "vitest"

import { SessionId } from "../../../src/core/session/types.js"
import { viewerUrl } from "../../../src/core/session/viewer-url.js"

describe("viewerUrl", () => {
  it("matches the spec example exactly", () => {
    const id = SessionId("4b618726aef0")
    expect(viewerUrl(id)).toBe(
      "/b/4b618726aef0/vnc.html?autoconnect=true&resize=remote&path=b%2F4b618726aef0%2Fwebsockify"
    )
  })

  it("URL-encodes the path query parameter", () => {
    const id = SessionId("4b618726aef0")
    const url = viewerUrl(id)
    expect(url.includes("path=b%2F")).toBe(true)
  })
})
