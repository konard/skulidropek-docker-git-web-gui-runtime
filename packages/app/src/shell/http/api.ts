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
import { Effect, Match } from "effect"

import { toDto } from "../../core/session/dto.js"
import { CreateSessionRequest } from "../../core/session/schema.js"
import { SessionId } from "../../core/session/types.js"
import { DockerError } from "../services/docker.js"
import {
  InvalidTransition,
  type ManagerError,
  PortExhausted,
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

const renderError = (
  e: SessionNotFound | PortExhausted | InvalidTransition | DockerError
): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
  Match.value(e).pipe(
    Match.tag("SessionNotFound", () => errorJson(404, "session not found")),
    Match.tag("PortExhausted", () => errorJson(503, "port range exhausted")),
    Match.tag("InvalidTransition", (it) => errorJson(409, it.reason)),
    Match.tag("DockerError", (de) => errorJson(502, `docker ${de.stage} failed`)),
    Match.exhaustive
  )

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
  eff: Effect.Effect<HttpServerResponse.HttpServerResponse, SessionNotFound | ManagerError, R>
) => eff.pipe(Effect.catchAll(renderError))

const post = HttpRouter.post(
  "/api/sessions",
  Effect.gen(function*(_) {
    const input = yield* _(HttpServerRequest.schemaBodyJson(CreateSessionRequest))
    const manager = yield* _(SessionManagerTag)
    const session = yield* _(manager.create(input))
    return yield* _(okJson(toDto(session), 201))
  }).pipe(
    Effect.catchAll((err) => {
      if (err instanceof PortExhausted || err instanceof InvalidTransition || err instanceof DockerError) {
        return renderError(err)
      }
      return errorJson(400, "invalid request body")
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

const logs = HttpRouter.get(
  "/api/sessions/:id/logs",
  handleSessionResult(withIdAndManager((m, id) => m.logs(id).pipe(Effect.flatMap((lines) => okJson({ lines })))))
)

export const apiRouter = HttpRouter.empty.pipe(post, list, get, remove, logs)
