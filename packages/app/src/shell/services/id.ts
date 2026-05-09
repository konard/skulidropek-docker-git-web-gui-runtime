// CHANGE: typed random hex-id service
// WHY: keep RNG behind a Tag so tests can inject deterministic ids
// QUOTE(TZ): "session_id ↔ ровно один container_id"
// REF: issue#1 section 22
// PURITY: SHELL
// EFFECT: Effect<SessionId, never, IdGen>
// INVARIANT: emit(n) returns a 12-char hex string drawn uniformly
// COMPLEXITY: O(n)/O(n)
import { Context, Effect, Layer, Random } from "effect"

import { SessionId } from "../../core/session/types.js"

const HEX = "0123456789abcdef"
const ID_LEN = 12

const charAt = (i: number): string => HEX.charAt(i)

export class IdGen extends Context.Tag("webx11/IdGen")<
  IdGen,
  { readonly newSessionId: Effect.Effect<SessionId> }
>() {}

const generate = Effect.gen(function*(_) {
  const buf: Array<string> = []
  for (let i = 0; i < ID_LEN; i = i + 1) {
    const n = yield* _(Random.nextIntBetween(0, HEX.length))
    buf.push(charAt(n))
  }
  return SessionId(buf.join(""))
})

export const IdGenLayer = Layer.succeed(IdGen, IdGen.of({ newSessionId: generate }))
