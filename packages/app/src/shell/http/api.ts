// CHANGE: HTTP routes for /api/sessions* (REST control plane)
// WHY: ТЗ section 8 pins these endpoints; route handlers stay thin and delegate to SessionManager
// QUOTE(TZ): "POST /api/sessions / GET /api/sessions/{id} / GET /api/sessions / DELETE /api/sessions/{id} / GET /api/sessions/{id}/logs"
// REF: issue#1 section 8
// PURITY: SHELL
// EFFECT: Effect<HttpServerResponse, never, SessionManager>
// INVARIANT: every handler returns 2xx with JSON DTO or 4xx/5xx with { error }
// COMPLEXITY: O(1)/O(1) per handler (excluding manager work)
import type { HttpServerResponse } from "@effect/platform"
import { HttpRouter, HttpServerRequest } from "@effect/platform"
import { Effect, Match, Option } from "effect"

import { toDto } from "../../core/session/dto.js"
import { CreateSessionRequest } from "../../core/session/schema.js"
import { SessionId } from "../../core/session/types.js"
import { findWorkspaceOption, listWorkspaceOptions, resolveWorkspaceLaunch } from "../../core/workspace/catalog.js"
import { toWorkspaceOptionDto } from "../../core/workspace/dto.js"
import { LaunchWorkspaceRequest } from "../../core/workspace/schema.js"
import type { DockerError } from "../services/docker.js"
import {
  type InvalidTransition,
  type PortExhausted,
  type SessionManager,
  SessionManagerTag
} from "../services/manager.js"
import type { SessionNotFound } from "../services/store.js"
import { errorJson, okJson } from "./responses.js"

const refineId = (raw: string | undefined): Effect.Effect<SessionId> =>
  raw === undefined
    ? Effect.die("missing :id route param")
    : Match.value(SessionId.either(raw)).pipe(
      Match.when({ _tag: "Right" }, ({ right }) => Effect.succeed(right)),
      Match.when({ _tag: "Left" }, () => Effect.die(`invalid SessionId: ${raw}`)),
      Match.exhaustive
    )

const onSessionNotFound = (): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
  errorJson(404, "session not found")
const onPortExhausted = (): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
  errorJson(503, "port range exhausted")
const onInvalidTransition = (it: InvalidTransition): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
  errorJson(409, it.reason)
const onDockerError = (de: DockerError): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
  errorJson(502, `docker ${de.stage} failed`)
const onBadBody = (): Effect.Effect<HttpServerResponse.HttpServerResponse> => errorJson(400, "invalid request body")
const onWorkspaceNotFound = (): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
  errorJson(404, "workspace not found")

const withIdAndManager = <A, E>(
  op: (manager: SessionManager, id: SessionId) => Effect.Effect<A, E>
) =>
  Effect.gen(function*(_) {
    const params = yield* _(HttpRouter.params)
    const id = yield* _(refineId(params["id"]))
    const manager = yield* _(SessionManagerTag)
    return yield* _(op(manager, id))
  })

const handleSessionResult = <R>(
  eff: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    SessionNotFound | PortExhausted | InvalidTransition | DockerError,
    R
  >
) =>
  eff.pipe(
    Effect.catchTags({
      SessionNotFound: onSessionNotFound,
      PortExhausted: onPortExhausted,
      InvalidTransition: onInvalidTransition,
      DockerError: onDockerError
    })
  )

const post = HttpRouter.post(
  "/api/sessions",
  Effect.gen(function*(_) {
    const input = yield* _(HttpServerRequest.schemaBodyJson(CreateSessionRequest))
    const manager = yield* _(SessionManagerTag)
    const session = yield* _(manager.create(input))
    return yield* _(okJson(toDto(session), 201))
  }).pipe(
    Effect.catchTags({
      PortExhausted: onPortExhausted,
      InvalidTransition: onInvalidTransition,
      DockerError: onDockerError,
      ParseError: onBadBody,
      RequestError: onBadBody
    })
  )
)

const listWorkspaces = HttpRouter.get(
  "/api/workspaces",
  okJson({ workspaces: listWorkspaceOptions().map((option) => toWorkspaceOptionDto(option)) })
)

const getWorkspace = HttpRouter.get(
  "/api/workspaces/:workspaceId",
  Effect.gen(function*(_) {
    const params = yield* _(HttpRouter.params)
    const workspaceId = params["workspaceId"] ?? ""
    return yield* _(
      Option.match(findWorkspaceOption(workspaceId), {
        onNone: onWorkspaceNotFound,
        onSome: (option) => okJson(toWorkspaceOptionDto(option))
      })
    )
  })
)

const postWorkspaceSession = HttpRouter.post(
  "/api/workspaces/:workspaceId/sessions",
  Effect.gen(function*(_) {
    const params = yield* _(HttpRouter.params)
    const workspaceId = params["workspaceId"] ?? ""
    const input = yield* _(HttpServerRequest.schemaBodyJson(LaunchWorkspaceRequest))
    const manager = yield* _(SessionManagerTag)
    return yield* _(
      Option.match(findWorkspaceOption(workspaceId), {
        onNone: onWorkspaceNotFound,
        onSome: (option) =>
          Option.match(resolveWorkspaceLaunch(option, input), {
            onNone: () =>
              errorJson(501, "workspace requires setup before launch", {
                workspace_id: option.id,
                availability: option.availability,
                launch_status: option.launchStatus,
                launch_surface: option.launchSurface,
                backend: option.backend,
                requirements: option.requirements,
                kasm: option.kasm ?? null
              }),
            onSome: (sessionInput) =>
              manager.create(sessionInput).pipe(
                Effect.flatMap((session) => okJson(toDto(session), 201)),
                Effect.catchTags({
                  PortExhausted: onPortExhausted,
                  InvalidTransition: onInvalidTransition,
                  DockerError: onDockerError
                })
              )
          })
      })
    )
  }).pipe(
    Effect.catchTags({
      ParseError: onBadBody,
      RequestError: onBadBody
    })
  )
)

const list = HttpRouter.get(
  "/api/sessions",
  Effect.gen(function*(_) {
    const manager = yield* _(SessionManagerTag)
    const sessions = yield* _(manager.list)
    return yield* _(okJson(sessions.map((s) => toDto(s))))
  })
)

const get = HttpRouter.get(
  "/api/sessions/:id",
  handleSessionResult(withIdAndManager((m, id) => m.get(id).pipe(Effect.flatMap((s) => okJson(toDto(s))))))
)

const remove = HttpRouter.del(
  "/api/sessions/:id",
  handleSessionResult(withIdAndManager((m, id) => m.remove(id).pipe(Effect.flatMap((s) => okJson(toDto(s))))))
)

const stop = HttpRouter.post(
  "/api/sessions/:id/stop",
  handleSessionResult(withIdAndManager((m, id) => m.stop(id).pipe(Effect.flatMap((s) => okJson(toDto(s))))))
)

const logs = HttpRouter.get(
  "/api/sessions/:id/logs",
  handleSessionResult(withIdAndManager((m, id) => m.logs(id).pipe(Effect.flatMap((lines) => okJson({ lines })))))
)

export const apiRouter = HttpRouter.empty.pipe(
  listWorkspaces,
  getWorkspace,
  postWorkspaceSession,
  post,
  list,
  get,
  stop,
  remove,
  logs
)
