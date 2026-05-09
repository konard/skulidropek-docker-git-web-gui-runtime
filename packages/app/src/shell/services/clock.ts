// CHANGE: provide a typed Clock service that yields JavaScript Dates
// WHY: SHELL needs a single, mockable Date source so tests stay deterministic
// QUOTE(TZ): "created_at TIMESTAMP NOT NULL / updated_at TIMESTAMP NOT NULL"
// REF: issue#1 section 14
// PURITY: SHELL
// EFFECT: Effect<Date, never, NowClock>
// INVARIANT: every read of NowClock returns the live instant; tests substitute fixed values
// COMPLEXITY: O(1)/O(1)
import { Clock, Context, Effect, Layer } from "effect"

export class NowClock extends Context.Tag("webx11/NowClock")<
  NowClock,
  { readonly now: Effect.Effect<Date> }
>() {}

const NowClockLive = Layer.succeed(
  NowClock,
  NowClock.of({
    now: Clock.currentTimeMillis.pipe(Effect.map((ms) => new Date(ms)))
  })
)

export const NowClockLayer = NowClockLive
