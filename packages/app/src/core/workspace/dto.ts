// CHANGE: JSON DTO for selectable workspace options
// WHY: clients need a stable shape for rendering launch choices and setup requirements
// QUOTE(TZ): "Что бы я мог выбирать нужное мне"
// REF: user request 2026-05-09
// SOURCE: n/a
// PURITY: CORE
// INVARIANT: DTO contains only JSON-safe values
// COMPLEXITY: O(1)/O(1)
import type { KasmWorkspaceTile, WorkspaceBackend, WorkspaceDefaults, WorkspaceOption } from "./catalog.js"

export interface WorkspaceOptionDto {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly description: string
  readonly availability: string
  readonly launch_status: string
  readonly launch_surface: string
  readonly backend: WorkspaceBackend
  readonly defaults: WorkspaceDefaults
  readonly requirements: ReadonlyArray<string>
  readonly kasm: KasmWorkspaceTile | null
  readonly launch_url: string
}

export const toWorkspaceOptionDto = (option: WorkspaceOption): WorkspaceOptionDto => ({
  id: option.id,
  name: option.name,
  category: option.category,
  description: option.description,
  availability: option.availability,
  launch_status: option.launchStatus,
  launch_surface: option.launchSurface,
  backend: option.backend,
  defaults: option.defaults,
  requirements: option.requirements,
  kasm: option.kasm ?? null,
  launch_url: `/api/workspaces/${option.id}/sessions`
})
