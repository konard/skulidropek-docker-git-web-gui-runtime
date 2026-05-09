// CHANGE: tests for the deterministic port allocator
// WHY: gateway port mapping is the only stateful resource in CORE; it must be exhaustive and pure
// REF: issue#1 section 9.2
// PURITY: CORE TESTS
// INVARIANT: ∀ used, range: result ∉ used ∧ range.min ≤ result ≤ range.max (when Some)
// COMPLEXITY: O(|range|)
import { Option } from "effect"
import { describe, expect, it } from "vitest"

import { allocatePort } from "../../../src/core/session/port-allocator.js"

describe("allocatePort", () => {
  it("picks the lowest free port in the range", () => {
    const r = allocatePort(new Set([16_080, 16_081]), { min: 16_080, max: 16_999 })
    expect(Option.getOrThrow(r)).toBe(16_082)
  })

  it("returns the range minimum when nothing is used", () => {
    const r = allocatePort(new Set(), { min: 16_080, max: 16_999 })
    expect(Option.getOrThrow(r)).toBe(16_080)
  })

  it("returns None when the range is exhausted", () => {
    const used = new Set([16_080, 16_081, 16_082])
    const r = allocatePort(used, { min: 16_080, max: 16_082 })
    expect(Option.isNone(r)).toBe(true)
  })

  it("never returns a port that is already used", () => {
    const used = new Set([16_080, 16_082, 16_084])
    const r = allocatePort(used, { min: 16_080, max: 16_999 })
    const port = Option.getOrThrow(r)
    expect(used.has(port)).toBe(false)
  })

  it("respects the inclusive range bounds", () => {
    const r = allocatePort(new Set(), { min: 9999, max: 9999 })
    expect(Option.getOrThrow(r)).toBe(9999)
  })

  it(String.raw`property: any allocated port is in (range \ used)`, () => {
    const range = { min: 16_080, max: 16_099 }
    for (let trial = 0; trial < 100; trial = trial + 1) {
      const used = new Set<number>()
      for (let i = range.min; i < range.min + (trial % 20); i = i + 1) used.add(i)
      const r = allocatePort(used, range)
      if (Option.isSome(r)) {
        expect(r.value).toBeGreaterThanOrEqual(range.min)
        expect(r.value).toBeLessThanOrEqual(range.max)
        expect(used.has(r.value)).toBe(false)
      }
    }
  })
})
