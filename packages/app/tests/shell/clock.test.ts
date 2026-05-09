// CHANGE: tests for the NowClock layer
// WHY: tests rely on injecting a fixed clock; verify the live layer yields a Date
// REF: issue#1 section 14
// PURITY: SHELL TESTS
// INVARIANT: NowClockLayer.now resolves to a real Date
// COMPLEXITY: O(1)
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { NowClock, NowClockLayer } from "../../src/shell/services/clock.js"

describe("NowClock (live)", () => {
  it("resolves to a Date instance", () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function*(_) {
          const c = yield* _(NowClock)
          const now = yield* _(c.now)
          expect(now).toBeInstanceOf(Date)
          expect(Number.isFinite(now.getTime())).toBe(true)
        }),
        NowClockLayer
      )
    ))
})
