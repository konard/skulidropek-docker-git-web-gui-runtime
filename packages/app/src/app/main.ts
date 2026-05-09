// CHANGE: wire HTTP server with Docker session manager and platform-node runtime
// WHY: ТЗ pins a single-process REST API + path-based gateway on one host
// QUOTE(TZ): "Сервис со своим REST API ... POST/GET/DELETE /api/sessions ... GET /b/<id>/vnc.html"
// REF: issue#1 sections 8, 9, 17
// PURITY: SHELL
// EFFECT: Effect<never, ServeError | ConfigError, never> at runtime
// INVARIANT: process exits cleanly on SIGINT/SIGTERM via NodeRuntime.runMain
// COMPLEXITY: O(1)/O(1)
import { NodeContext, NodeHttpClient, NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { createServer } from "node:http"

import { serverLayer } from "../shell/http/server.js"
import { NowClockLayer } from "../shell/services/clock.js"
import { DockerLayer } from "../shell/services/docker.js"
import { IdGenLayer } from "../shell/services/id.js"
import { SessionManagerLayer } from "../shell/services/manager.js"
import { SessionStoreLayer } from "../shell/services/store.js"

const port = Number(process.env["PORT"] ?? 8080)

const HttpLayer = NodeHttpServer.layer(() => createServer(), { port })

const ServicesLayer = Layer.mergeAll(
  SessionStoreLayer,
  DockerLayer,
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
