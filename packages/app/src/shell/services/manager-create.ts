// CHANGE: createOp — id+port allocation, docker run, transition CREATED→STARTING→READY
// WHY: keep manager.ts ≤300 LOC and each function ≤50 LOC by isolating the create flow
// QUOTE(TZ): "POST /api/sessions ... { id, status: STARTING, viewer_url }"
// REF: issue#1 sections 5, 8.1, 11.1
// PURITY: SHELL
// EFFECT: Effect<Session, ManagerError, never>
// INVARIANT: returned session has containerId !== null and status === "READY"
// COMPLEXITY: O(|range|)/O(1)
import { Effect, Option, Schedule } from "effect"

import { buildDockerRunArgs } from "../../core/session/docker-args.js"
import { createSession, type CreateSessionInput } from "../../core/session/factory.js"
import { allocatePort } from "../../core/session/port-allocator.js"
import type { Session } from "../../core/session/types.js"
import type { CreateDeps } from "./manager-deps.js"
import { transitionAndStore } from "./manager-shared.js"
import { type ManagerError, PortExhausted } from "./manager.js"

const PORT_RANGE: { readonly min: number; readonly max: number } = { min: 16_100, max: 16_999 }
const INSPECT_RETRY = Schedule.spaced("100 millis").pipe(Schedule.intersect(Schedule.recurs(10)))

const allocate = (
  deps: Pick<CreateDeps, "store">
): Effect.Effect<number, PortExhausted> =>
  deps.store.usedPorts.pipe(Effect.flatMap((used) =>
    Option.match(allocatePort(used, PORT_RANGE), {
      onNone: () => Effect.fail(new PortExhausted(PORT_RANGE)),
      onSome: (p) => Effect.succeed(p)
    })
  ))

const markCreateFailed = (
  deps: Pick<CreateDeps, "store" | "clock">,
  session: Session,
  stage: string
): Effect.Effect<void> =>
  transitionAndStore(deps, session, { _tag: "Fail", reason: `docker ${stage} failed` }).pipe(
    Effect.ignore
  )

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
    const containerId = yield* _(
      deps.docker.run(argv).pipe(
        Effect.tapError((err) => markCreateFailed(deps, starting, err.stage))
      )
    )
    const novncHost = yield* _(
      deps.docker.inspectIp(containerId).pipe(
        Effect.retry(INSPECT_RETRY),
        Effect.tapError((err) =>
          deps.docker.rm(containerId).pipe(
            Effect.ignore,
            Effect.zipRight(markCreateFailed(deps, starting, err.stage))
          )
        )
      )
    )
    const withContainer = { ...starting, containerId, novncHost }
    yield* _(deps.store.put(withContainer))
    return yield* _(transitionAndStore(deps, withContainer, { _tag: "MarkReady" }))
  })
