// CHANGE: typed wrapper around `docker` CLI for the session manager
// WHY: keep all process spawning behind a single Tag so tests can substitute a fake
// QUOTE(TZ): "Runtime: Docker Engine API"
// REF: issue#1 sections 4.1, 7
// PURITY: SHELL
// EFFECT: Effect<*, DockerError, Docker>
// INVARIANT: every operation either succeeds with the documented output or returns DockerError
// COMPLEXITY: O(1)/O(1) per call (size of argv/output dominates)
import { Command, CommandExecutor } from "@effect/platform"
import { Context, Data, Effect, Layer } from "effect"

import type { ContainerId } from "../../core/session/types.js"
import { ContainerId as ContainerIdBrand } from "../../core/session/types.js"

export class DockerError extends Data.TaggedError("DockerError")<{
  readonly stage: "run" | "stop" | "rm" | "logs" | "inspect"
  readonly cause: string
}> {}

export interface Docker {
  readonly run: (args: ReadonlyArray<string>) => Effect.Effect<ContainerId, DockerError>
  readonly stop: (id: ContainerId) => Effect.Effect<void, DockerError>
  readonly rm: (id: ContainerId) => Effect.Effect<void, DockerError>
  readonly logs: (id: ContainerId) => Effect.Effect<ReadonlyArray<string>, DockerError>
}

export class DockerTag extends Context.Tag("webx11/Docker")<DockerTag, Docker>() {}

const runCli = (
  stage: DockerError["stage"],
  args: ReadonlyArray<string>
) =>
  Effect.mapError(
    Command.string(Command.make("docker", ...args)),
    (err) => new DockerError({ stage, cause: String(err) })
  )

const parseContainerId = (raw: string): Effect.Effect<ContainerId, DockerError> =>
  Effect.try({
    try: () => ContainerIdBrand(raw.trim()),
    catch: (err) => new DockerError({ stage: "run", cause: String(err) })
  })

const splitLines = (out: string): ReadonlyArray<string> =>
  out.split("\n").map((s) => s.trim()).filter((l) => l.length > 0)

const liveDocker: Effect.Effect<Docker, never, CommandExecutor.CommandExecutor> = CommandExecutor.CommandExecutor.pipe(
  Effect.map((executor) => {
    const provide = <A, E>(eff: Effect.Effect<A, E, CommandExecutor.CommandExecutor>) =>
      Effect.provideService(eff, CommandExecutor.CommandExecutor, executor)
    return {
      run: (args) => provide(runCli("run", args).pipe(Effect.flatMap((raw) => parseContainerId(raw)))),
      stop: (id) => Effect.asVoid(provide(runCli("stop", ["stop", id]))),
      rm: (id) => Effect.asVoid(provide(runCli("rm", ["rm", "-f", id]))),
      logs: (id) =>
        provide(runCli("logs", ["logs", "--tail", "200", id])).pipe(
          Effect.map((out) => splitLines(out))
        )
    } satisfies Docker
  })
)

export const DockerLayer = Layer.effect(DockerTag, liveDocker)
