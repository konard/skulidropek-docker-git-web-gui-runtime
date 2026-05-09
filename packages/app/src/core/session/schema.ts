// CHANGE: schema decoders for the POST /api/sessions request body
// WHY: keep the decode logic in CORE so the HTTP route only orchestrates the call
// QUOTE(TZ): "POST /api/sessions { name, image, app, resolution: { width,height,depth }, resources: { cpus,memory_mb,shm_mb }, ttl_seconds }"
// REF: issue#1 section 8.1
// PURITY: CORE
// INVARIANT: decoded record satisfies CreateSessionInput
// COMPLEXITY: O(1)/O(1)
import { Schema } from "effect"

const PositiveInt = Schema.Int.pipe(Schema.greaterThan(0))

export const ResolutionSchema = Schema.Struct({
  width: PositiveInt,
  height: PositiveInt,
  depth: PositiveInt
})

export const ResourcesSchema = Schema.Struct({
  cpus: Schema.Number.pipe(Schema.greaterThan(0)),
  memoryMb: PositiveInt,
  shmMb: PositiveInt
})

export const CreateSessionRequest = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64)),
  image: Schema.String.pipe(Schema.minLength(1)),
  app: Schema.String.pipe(Schema.minLength(1)),
  resolution: ResolutionSchema,
  resources: ResourcesSchema,
  ttlSeconds: PositiveInt
})
