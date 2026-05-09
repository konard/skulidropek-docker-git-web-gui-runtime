// CHANGE: shared SHELL test layers (fake docker, fixed clock, sequential ids)
// WHY: gateway/api/manager tests build the same layer stack — extract once
// REF: issue#1 sections 8, 9, 12
// PURITY: TEST FIXTURES (Effect-only side effects)
// INVARIANT: layers depend only on the supplied refs/ids; no global mutable state
// COMPLEXITY: O(1) per call
import { Effect, Layer, Ref } from "effect"

import { ContainerId, SessionId } from "../../src/core/session/types.js"
import { NowClock } from "../../src/shell/services/clock.js"
import { type Docker, DockerTag } from "../../src/shell/services/docker.js"
import { IdGen } from "../../src/shell/services/id.js"
import { SessionManagerLayer } from "../../src/shell/services/manager.js"
import { SessionStoreLayer } from "../../src/shell/services/store.js"
import { FIXED_CONTAINER, FIXED_ID, FIXED_NOW } from "../_fixtures.js"

export interface DockerCalls {
  readonly run: ReadonlyArray<ReadonlyArray<string>>
  readonly stop: ReadonlyArray<string>
  readonly rm: ReadonlyArray<string>
  readonly logs: ReadonlyArray<string>
}

export const emptyCalls: DockerCalls = { run: [], stop: [], rm: [], logs: [] }

export const makeFakeDocker = (
  callsRef: Ref.Ref<DockerCalls>,
  override: Partial<Docker> = {}
): Docker => ({
  run: (args) =>
    Ref.update(callsRef, (c) => ({ ...c, run: [...c.run, args] })).pipe(
      Effect.zipRight(Effect.succeed(ContainerId(FIXED_CONTAINER)))
    ),
  stop: (id) => Ref.update(callsRef, (c) => ({ ...c, stop: [...c.stop, id] })),
  rm: (id) => Ref.update(callsRef, (c) => ({ ...c, rm: [...c.rm, id] })),
  logs: (id) =>
    Ref.update(callsRef, (c) => ({ ...c, logs: [...c.logs, id] })).pipe(
      Effect.zipRight(Effect.succeed<ReadonlyArray<string>>(["line1", "line2"]))
    ),
  ...override
})

export const fakeDockerLayer = (
  callsRef: Ref.Ref<DockerCalls>,
  override: Partial<Docker> = {}
) => Layer.succeed(DockerTag, makeFakeDocker(callsRef, override))

export const fixedClock = Layer.succeed(NowClock, NowClock.of({ now: Effect.succeed(FIXED_NOW) }))

export const sequentialIds = (ids: ReadonlyArray<string> = [FIXED_ID]) =>
  Layer.effect(
    IdGen,
    Effect.gen(function*(_) {
      const ref = yield* _(Ref.make(0))
      return IdGen.of({
        newSessionId: Ref.getAndUpdate(ref, (i) => i + 1).pipe(
          Effect.map((i) => SessionId(ids[i] ?? ids.at(-1) ?? FIXED_ID))
        )
      })
    })
  )

export const buildManagerLayer = (
  callsRef: Ref.Ref<DockerCalls>,
  ids: ReadonlyArray<string> = [FIXED_ID],
  dockerOverride: Partial<Docker> = {}
) =>
  SessionManagerLayer.pipe(
    Layer.provide(
      Layer.mergeAll(SessionStoreLayer, fakeDockerLayer(callsRef, dockerOverride), sequentialIds(ids), fixedClock)
    )
  )

export const makeFreshManagerLayer = (): ReturnType<typeof buildManagerLayer> =>
  buildManagerLayer(Effect.runSync(Ref.make(emptyCalls)))
