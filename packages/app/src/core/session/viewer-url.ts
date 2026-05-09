// CHANGE: pure viewer-URL formatter
// WHY: ТЗ pins the exact path/query layout; centralise it so gateway and tests share one source of truth
// QUOTE(TZ): "/b/<session_id>/vnc.html?autoconnect=true&resize=remote&path=b%2F<session_id>%2Fwebsockify"
// REF: issue#1 sections 1, 8.1, 9.1
// PURITY: CORE
// INVARIANT: viewerUrl(id) decodes back to a path that startsWith /b/<id>/vnc.html
// COMPLEXITY: O(|id|) time / O(|id|) space
import type { SessionId } from "./types.js"

/**
 * Build the viewer URL for a session.
 *
 * @param id - validated session identifier
 * @returns absolute path that the gateway routes to the noVNC client
 *
 * @example
 *   viewerUrl(SessionId("4b618726aef0"))
 *     === "/b/4b618726aef0/vnc.html?autoconnect=true&resize=remote&path=b%2F4b618726aef0%2Fwebsockify"
 */
export const viewerUrl = (id: SessionId): string => {
  const path = `b/${id}/websockify`
  const encoded = encodeURIComponent(path)
  return `/b/${id}/vnc.html?autoconnect=true&resize=remote&path=${encoded}`
}
