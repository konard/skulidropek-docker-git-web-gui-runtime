// CHANGE: schema for launching a session from a saved workspace option
// WHY: clients may override name, resolution, resources and TTL while keeping backend policy server-side
// QUOTE(TZ): "добавить все эти настройки"
// REF: user request 2026-05-09
// SOURCE: n/a
// PURITY: CORE
// INVARIANT: decoded overrides satisfy LaunchWorkspaceInput
// COMPLEXITY: O(1)/O(1)
import { Schema } from "effect"

import { ResolutionSchema, ResourcesSchema } from "../session/schema.js"

const PositiveInt = Schema.Int.pipe(Schema.greaterThan(0))

export const LaunchWorkspaceRequest = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64))),
  resolution: Schema.optional(ResolutionSchema),
  resources: Schema.optional(ResourcesSchema),
  ttlSeconds: Schema.optional(PositiveInt)
})
