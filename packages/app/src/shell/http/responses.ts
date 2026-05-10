// CHANGE: shared HTTP response helpers (JSON success / error)
// WHY: api.ts and gateway.ts share the same error+ok response shape
// QUOTE(TZ): "REST ... { error } / 4xx/5xx"
// REF: issue#1 sections 8, 9
// PURITY: SHELL
// EFFECT: Effect<HttpServerResponse, never, never>
// INVARIANT: any failure to encode JSON falls back to plain text
// COMPLEXITY: O(1)/O(1)
import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

export const errorJson = (
  status: number,
  message: string,
  extra: object = {}
) =>
  HttpServerResponse.json({ error: message, ...extra }, { status }).pipe(
    Effect.orElseSucceed(() => HttpServerResponse.text(message, { status }))
  )

export const okJson = (body: object, status = 200) =>
  HttpServerResponse.json(body, { status }).pipe(
    Effect.orElseSucceed(() => HttpServerResponse.text(JSON.stringify(body), { status }))
  )
