// CHANGE: tests for the IdGen layer
// WHY: ids must be 12-char lowercase hex; verify shape & uniqueness across calls
// REF: issue#1 section 22
// PURITY: SHELL TESTS
// INVARIANT: every emitted id matches /^[0-9a-f]{12}$/
// COMPLEXITY: O(n) for n samples
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { IdGen, IdGenLayer } from "../../src/shell/services/id.js"

const HEX12 = /^[0-9a-f]{12}$/

const sample = (n: number) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function*(_) {
        const gen = yield* _(IdGen)
        const out: Array<string> = []
        for (let i = 0; i < n; i = i + 1) {
          const id = yield* _(gen.newSessionId)
          out.push(id)
        }
        return out
      }),
      IdGenLayer
    )
  )

describe("IdGen", () => {
  it("produces 12-char lowercase hex ids", () =>
    sample(20).then((ids) => {
      for (const id of ids) expect(HEX12.test(id)).toBe(true)
    }))

  it("produces distinct ids across many draws (probabilistic, n=200)", () =>
    sample(200).then((ids) => {
      const set = new Set(ids)
      expect(set.size).toBe(ids.length)
    }))
})
