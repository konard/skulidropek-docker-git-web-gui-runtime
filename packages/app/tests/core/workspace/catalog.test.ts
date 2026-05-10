// CHANGE: tests for selectable workspace catalog
// WHY: clients depend on stable ids and launchability semantics for backend selection
// REF: user request 2026-05-09
// PURITY: CORE TESTS
// INVARIANT: only webx11-container options resolve to CreateSessionInput
// COMPLEXITY: O(n)
import { Option } from "effect"
import { describe, expect, it } from "vitest"

import {
  findWorkspaceOption,
  listWorkspaceOptions,
  resolveWorkspaceLaunch
} from "../../../src/core/workspace/catalog.js"

describe("workspace catalog", () => {
  it("contains Linux, Android, Windows and Wine choices", () => {
    const ids = listWorkspaceOptions().map((option) => option.id)
    expect(ids).toContain("visual-studio-code")
    expect(ids).toContain("android-redroid")
    expect(ids).toContain("windows-rdp-existing")
    expect(ids).toContain("windows-vm-create")
    expect(ids).toContain("windows-remoteapp")
    expect(ids).toContain("windows-wine")
  })

  it("describes Kasm UI tiles for Android and Wine", () => {
    const android = findWorkspaceOption("android-redroid")
    const wine = findWorkspaceOption("windows-wine")
    expect(Option.isSome(android)).toBe(true)
    expect(Option.isSome(wine)).toBe(true)
    if (Option.isNone(android) || Option.isNone(wine)) return

    expect(android.value.launchSurface).toBe("kasm-ui")
    expect(android.value.kasm?.dockerImage).toBe("kasmweb/redroid:1.18.0")
    expect(android.value.kasm?.runConfig).toMatchObject({ privileged: true })
    expect(wine.value.launchSurface).toBe("kasm-ui")
    expect(wine.value.kasm?.friendlyName).toBe("Windows Apps (Wine)")
    expect(wine.value.kasm?.persistentProfilePath).toContain("windows-wine")
  })

  it("resolves launchable Web-X11 options to session input", () => {
    const option = findWorkspaceOption("visual-studio-code")
    expect(Option.isSome(option)).toBe(true)
    if (Option.isNone(option)) return

    const input = resolveWorkspaceLaunch(option.value, { name: "code-review" })
    expect(Option.isSome(input)).toBe(true)
    if (Option.isNone(input)) return

    expect(input.value.name).toBe("code-review")
    expect(input.value.image).toBe("webx11-vscode:latest")
    expect(input.value.app).toContain("code --no-sandbox")
  })

  it("does not resolve Windows VM strategy to a Docker session input", () => {
    const option = findWorkspaceOption("windows-vm-create")
    expect(Option.isSome(option)).toBe(true)
    if (Option.isNone(option)) return

    expect(Option.isNone(resolveWorkspaceLaunch(option.value, {}))).toBe(true)
  })
})
