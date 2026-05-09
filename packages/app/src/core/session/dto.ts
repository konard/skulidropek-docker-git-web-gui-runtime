// CHANGE: pure adapter from Session domain → JSON-friendly DTO
// WHY: ТЗ pins the public response shape; centralise it so all routes return a single layout
// QUOTE(TZ): "GET /api/sessions/{id} ... возвращает текущее состояние сессии { id, status, viewer_url, ... }"
// REF: issue#1 section 8.2
// PURITY: CORE
// INVARIANT: DTO field order/names are stable; no Date objects leak — only ISO strings
// COMPLEXITY: O(1)/O(1)
import type { Session } from "./types.js"
import { viewerUrl } from "./viewer-url.js"

export interface SessionDto {
  readonly id: string
  readonly name: string
  readonly status: string
  readonly viewer_url: string
  readonly novnc_port: number
  readonly container_id: string | null
  readonly created_at: string
  readonly updated_at: string
  readonly expires_at: string
  readonly stopped_at: string | null
  readonly failure_reason: string | null
}

export const toDto = (session: Session): SessionDto => ({
  id: session.id,
  name: session.name,
  status: session.status,
  viewer_url: viewerUrl(session.id),
  novnc_port: session.novncPort,
  container_id: session.containerId,
  created_at: session.createdAt.toISOString(),
  updated_at: session.updatedAt.toISOString(),
  expires_at: session.expiresAt.toISOString(),
  stopped_at: session.stoppedAt === null ? null : session.stoppedAt.toISOString(),
  failure_reason: session.failureReason
})
