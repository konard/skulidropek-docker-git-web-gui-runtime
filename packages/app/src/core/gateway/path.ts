// CHANGE: pure parser for the gateway's /b/<session_id>/<rest> path scheme
// WHY: keep routing decisions deterministic, testable, and free of any HTTP framework
// QUOTE(TZ): "Путь /b/<session_id>/vnc.html должен отдавать noVNC-клиент конкретной сессии"
// REF: issue#1 section 9
// PURITY: CORE
// INVARIANT: parseGatewayPath ∘ formatGatewayPath = id (for valid inputs)
// COMPLEXITY: O(|path|)/O(|path|)
import { Match, Option } from "effect"

import { SessionId } from "../session/types.js"

/**
 * Decoded gateway path: which session it targets and the rest of the URL inside the container.
 */
export interface GatewayRoute {
  readonly sessionId: SessionId
  readonly subPath: string
}

const PREFIX = "/b/"

const refineSessionId = (raw: string): Option.Option<SessionId> =>
  Match.value(SessionId.either(raw)).pipe(
    Match.when({ _tag: "Right" }, (r) => Option.fromNullable<SessionId>(r.right)),
    Match.when({ _tag: "Left" }, () => Option.none<SessionId>()),
    Match.exhaustive
  )

/**
 * Parse a request path of the form `/b/<session_id>/<rest>`.
 *
 * @returns Some(GatewayRoute) when the path matches the gateway scheme; None otherwise.
 * @invariant rest is never undefined; it defaults to "" for `/b/<id>` and `/b/<id>/`.
 * @complexity O(|path|)
 */
export const parseGatewayPath = (path: string): Option.Option<GatewayRoute> => {
  if (!path.startsWith(PREFIX)) return Option.none()
  const rest = path.slice(PREFIX.length)
  const slash = rest.indexOf("/")
  const rawId = slash === -1 ? rest : rest.slice(0, slash)
  const subPath = slash === -1 ? "" : rest.slice(slash + 1)
  return Option.map(refineSessionId(rawId), (sessionId) => ({ sessionId, subPath }))
}

/**
 * Inverse of `parseGatewayPath` for valid inputs.
 *
 * @complexity O(|subPath|)
 */
export const formatGatewayPath = (route: GatewayRoute): string =>
  route.subPath.length === 0
    ? `${PREFIX}${route.sessionId}/`
    : `${PREFIX}${route.sessionId}/${route.subPath}`
