// CHANGE: createOp — id+port allocation, docker run, transition CREATED→STARTING→READY
// WHY: keep manager.ts ≤300 LOC and each function ≤50 LOC by isolating the create flow
// QUOTE(TZ): "POST /api/sessions ... { id, status: STARTING, viewer_url }"
// REF: issue#1 sections 5, 8.1, 11.1
// PURITY: SHELL
// EFFECT: Effect<Session, ManagerError, never>
// INVARIANT: returned session has containerId !== null and status === "READY"
// COMPLEXITY: O(|range|)/O(1)
import { Effect, Option } from "effect"

import { buildDockerRunArgs } from "../../core/session/docker-args.js"
import { createSession, type CreateSessionInput } from "../../core/session/factory.js"
import { allocatePort } from "../../core/session/port-allocator.js"
import type { Session } from "../../core/session/types.js"
import type { CreateDeps } from "./manager-deps.js"
import { transitionAndStore } from "./manager-shared.js"
import { type ManagerError, PortExhausted } from "./manager.js"

const PORT_RANGE = { min: 16_080, max: 16_999 } as const

const allocate = (
  deps: Pick<CreateDeps, "store">
): Effect.Effect<number, PortExhausted> =>
  deps.store.usedPorts.pipe(Effect.flatMap((used) =>
    Option.match(allocatePort(used, PORT_RANGE), {
      onNone: () => Effect.fail(new PortExhausted(PORT_RANGE)),
      onSome: (p) => Effect.succeed(p)
    })
  ))

export const createOp = (
  deps: CreateDeps,
  input: CreateSessionInput
): Effect.Effect<Session, ManagerError> =>
  Effect.gen(function*(_) {
    const id = yield* _(deps.ids.newSessionId)
    const port = yield* _(allocate(deps))
    const now = yield* _(deps.clock.now)
    const initial = createSession(input, { id, novncPort: port, now })
    yield* _(deps.store.put(initial))
    const starting = yield* _(transitionAndStore(deps, initial, { _tag: "Start" }))
    const argv = buildDockerRunArgs(starting, port, {})
    const containerId = yield* _(deps.docker.run(argv))
    const withContainer = { ...starting, containerId }
    yield* _(deps.store.put(withContainer))
    return yield* _(transitionAndStore(deps, withContainer, { _tag: "MarkReady" }))
  })
