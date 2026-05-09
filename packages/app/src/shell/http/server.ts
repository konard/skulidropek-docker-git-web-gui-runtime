// CHANGE: HTTP server program: combine api + gateway routers and serve them
// WHY: ТЗ section 8/9 places control plane and viewer plane on the same host
// QUOTE(TZ): "POST /api/sessions ... GET /b/<session_id>/vnc.html?..."
// REF: issue#1 sections 8, 9
// PURITY: SHELL
// EFFECT: Effect<void, ServeError, NodeContext | SessionManager | HttpClient>
// INVARIANT: routes are concatenated in API → gateway order
// COMPLEXITY: O(1)/O(1)
import { HttpRouter, HttpServer } from "@effect/platform"
import { Layer } from "effect"

import { apiRouter } from "./api.js"
import { gatewayRouter } from "./gateway.js"

const router = HttpRouter.concatAll(apiRouter, gatewayRouter)

export const serverLayer = HttpServer.serve(router).pipe(Layer.discard)
