// CHANGE: demo runner that boots the real HTTP server with a fake Docker layer
// WHY: prove control plane and gateway routes wire up end-to-end without a real Docker daemon
// REF: issue#1 sections 8, 9, 12; PR#2 reviewer request for "пруфы что она реально работает"
// PURITY: SHELL (experiments)
// EFFECT: starts a Node HTTP server bound to PORT (default 8080)
import { NodeContext, NodeHttpClient, NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Ref } from "effect"
import { createServer } from "node:http"

import { ContainerId } from "../src/core/session/types.js"
import { serverLayer } from "../src/shell/http/server.js"
import { NowClockLayer } from "../src/shell/services/clock.js"
import { type Docker, DockerTag } from "../src/shell/services/docker.js"
import { IdGenLayer } from "../src/shell/services/id.js"
import { SessionManagerLayer } from "../src/shell/services/manager.js"
import { SessionStoreLayer } from "../src/shell/services/store.js"

const port = Number(process.env["PORT"] ?? 8080)

const fakeDockerLayer = Layer.effect(
  DockerTag,
  Effect.gen(function*(_) {
    const counter = yield* _(Ref.make(0))
    const fake: Docker = {
      run: () =>
        Ref.updateAndGet(counter, (n) => n + 1).pipe(
          Effect.map((n) => ContainerId(`fake-container-${n.toString().padStart(12, "0")}`))
        ),
      stop: () => Effect.void,
      rm: () => Effect.void,
      logs: () => Effect.succeed<ReadonlyArray<string>>([
        "[runtime] Starting Xvfb on :99 (1280x720x24)",
        "[runtime] Starting window manager (openbox)",
        "[runtime] Starting app: xterm",
        "[runtime] Starting x11vnc on 127.0.0.1:5900",
        "[runtime] Starting websockify/noVNC on 0.0.0.0:6080",
        "[runtime] Ready"
      ])
    }
    return fake
  })
)

const HttpLayer = NodeHttpServer.layer(() => createServer(), { port })

const ServicesLayer = Layer.mergeAll(
  SessionStoreLayer,
  fakeDockerLayer,
  IdGenLayer,
  NowClockLayer
)

const ManagerLayer = SessionManagerLayer.pipe(Layer.provide(ServicesLayer))

const AppLayer = serverLayer.pipe(
  Layer.provide(HttpLayer),
  Layer.provide(NodeHttpClient.layer),
  Layer.provide(ManagerLayer),
  Layer.provide(NodeContext.layer)
)

NodeRuntime.runMain(Layer.launch(AppLayer))
