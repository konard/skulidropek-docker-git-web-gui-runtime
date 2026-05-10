// CHANGE: add a pure catalog of selectable workspace launch options
// WHY: the API needs to expose supported Linux, Android, Windows and Wine strategies
//      without hard-coding one GUI app per client request.
// QUOTE(TZ): "Что бы я мог выбирать нужное мне"
// REF: user request 2026-05-09
// SOURCE: n/a
// FORMAT THEOREM: ∀ option ∈ WORKSPACE_CATALOG: option.backend.type determines whether it can be launched by this runtime now
// PURITY: CORE
// INVARIANT: launchable options always resolve to a complete CreateSessionInput
// COMPLEXITY: O(n)/O(n) for listing, O(n)/O(1) for lookup
import { Option } from "effect"

import type { CreateSessionInput } from "../session/factory.js"
import type { Resolution, Resources } from "../session/types.js"

export type WorkspaceAvailability = "launchable" | "requires-setup" | "experimental"
export type WorkspaceLaunchStatus = "ready" | "requires-setup" | "experimental" | "manual"
export type WorkspaceLaunchSurface = "api-session" | "kasm-ui" | "external"

export type WorkspaceBackend =
  | {
    readonly type: "webx11-container"
    readonly image: string
    readonly app: string
  }
  | {
    readonly type: "kasm-container"
    readonly image: string
  }
  | {
    readonly type: "android-redroid"
    readonly image: string
  }
  | {
    readonly type: "windows-rdp-existing"
  }
  | {
    readonly type: "windows-remoteapp"
  }
  | {
    readonly type: "windows-vm-create"
  }
  | {
    readonly type: "wine-container"
    readonly image: string
  }

export interface WorkspaceDefaults {
  readonly resolution: Resolution
  readonly resources: Resources
  readonly ttlSeconds: number
}

export interface WorkspaceOption {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly description: string
  readonly availability: WorkspaceAvailability
  readonly launchStatus: WorkspaceLaunchStatus
  readonly launchSurface: WorkspaceLaunchSurface
  readonly backend: WorkspaceBackend
  readonly defaults: WorkspaceDefaults
  readonly requirements: ReadonlyArray<string>
  readonly kasm?: KasmWorkspaceTile | undefined
}

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray
export interface JsonObject {
  readonly [key: string]: JsonValue
}
export type JsonArray = ReadonlyArray<JsonValue>

export interface KasmWorkspaceTile {
  readonly friendlyName: string
  readonly imageSrc: string
  readonly dockerImage: string
  readonly categories: ReadonlyArray<string>
  readonly runConfig: JsonObject
  readonly execConfig: JsonObject
  readonly persistentProfilePath?: string | undefined
}

export interface LaunchWorkspaceInput {
  readonly name?: string | undefined
  readonly resolution?: Resolution | undefined
  readonly resources?: Resources | undefined
  readonly ttlSeconds?: number | undefined
}

interface WebX11OptionInput {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly description: string
  readonly image: string
  readonly app: string
  readonly defaults: WorkspaceDefaults
}

const compact: WorkspaceDefaults = {
  resolution: { width: 1280, height: 720, depth: 24 },
  resources: { cpus: 1, memoryMb: 1024, shmMb: 256 },
  ttlSeconds: 3600
}

const standard: WorkspaceDefaults = {
  resolution: { width: 1280, height: 720, depth: 24 },
  resources: { cpus: 2, memoryMb: 2048, shmMb: 1024 },
  ttlSeconds: 3600
}

const desktop: WorkspaceDefaults = {
  resolution: { width: 1600, height: 900, depth: 24 },
  resources: { cpus: 2, memoryMb: 4096, shmMb: 2048 },
  ttlSeconds: 3600
}

const webx11 = (input: WebX11OptionInput): WorkspaceOption => ({
  id: input.id,
  name: input.name,
  category: input.category,
  description: input.description,
  availability: "launchable",
  launchStatus: "ready",
  launchSurface: "api-session",
  backend: { type: "webx11-container", image: input.image, app: input.app },
  defaults: input.defaults,
  requirements: []
})

const kasm = (
  id: string,
  name: string,
  category: string,
  image: string,
  defaults: WorkspaceDefaults = standard
): WorkspaceOption => ({
  id,
  name,
  category,
  description: `${name} через Kasm-compatible container image.`,
  availability: "requires-setup",
  launchStatus: "requires-setup",
  launchSurface: "kasm-ui",
  backend: { type: "kasm-container", image },
  defaults,
  requirements: ["kasm-runner", "image-pull"],
  kasm: {
    friendlyName: name,
    imageSrc: "img/thumbnails/ubuntu.png",
    dockerImage: image,
    categories: [category],
    runConfig: { hostname: "kasm" },
    execConfig: {}
  }
})

export const WORKSPACE_CATALOG: ReadonlyArray<WorkspaceOption> = [
  webx11({
    id: "xeyes",
    name: "Xeyes",
    category: "Linux",
    description: "Минимальное X11 GUI-приложение для smoke-test.",
    image: "webx11-runtime:latest",
    app: "/usr/bin/xeyes",
    defaults: compact
  }),
  webx11({
    id: "visual-studio-code",
    name: "Visual Studio Code",
    category: "Development",
    description: "VS Code image, собранный поверх Web-X11 runtime.",
    image: "webx11-vscode:latest",
    app:
      "code --no-sandbox --disable-gpu --no-first-run --disable-workspace-trust --user-data-dir=/tmp/vscode-user-data --new-window /workspace --wait",
    defaults: desktop
  }),
  kasm("brave", "Brave", "Browser", "kasmweb/brave:1.18.0"),
  kasm("chrome", "Chrome", "Browser", "kasmweb/chrome:1.18.0"),
  kasm("chromium", "Chromium", "Browser", "kasmweb/chromium:1.18.0"),
  kasm("discord", "Discord", "Communication", "kasmweb/discord:1.18.0"),
  kasm("edge", "Edge", "Browser", "kasmweb/edge:1.18.0"),
  kasm("filezilla", "FileZilla", "Productivity", "kasmweb/filezilla:1.18.0"),
  kasm("firefox", "Firefox", "Browser", "kasmweb/firefox:1.18.0"),
  kasm("gimp", "Gimp", "Multimedia", "kasmweb/gimp:1.18.0"),
  kasm("insomnia", "Insomnia", "Development", "kasmweb/insomnia:1.18.0"),
  kasm("libre-office", "Libre Office", "Productivity", "kasmweb/libre-office:1.18.0", desktop),
  kasm("only-office", "Only Office", "Productivity", "kasmweb/only-office:1.18.0", desktop),
  kasm("remmina", "Remmina", "Productivity", "kasmweb/remmina:1.18.0"),
  kasm("signal", "Signal", "Communication", "kasmweb/signal:1.18.0"),
  kasm("sublime-text", "Sublime Text", "Development", "kasmweb/sublime-text:1.18.0"),
  kasm("telegram", "Telegram", "Communication", "kasmweb/telegram:1.18.0"),
  kasm("terminal", "Terminal", "Linux", "kasmweb/terminal:1.18.0"),
  kasm("thunderbird", "Thunderbird", "Productivity", "kasmweb/thunderbird:1.18.0"),
  kasm("tor-browser", "Tor-Browser", "Browser", "kasmweb/tor-browser:1.18.0"),
  kasm("ubuntu-jammy", "Ubuntu Jammy", "Desktop", "kasmweb/ubuntu-jammy-desktop:1.18.0", desktop),
  kasm("ubuntu-noble", "Ubuntu Noble", "Desktop", "kasmweb/ubuntu-noble-desktop:1.18.0", desktop),
  kasm("vivaldi", "Vivaldi", "Browser", "kasmweb/vivaldi:1.18.0"),
  kasm("vlc", "VLC", "Multimedia", "kasmweb/vlc:1.18.0"),
  kasm("zoom", "Zoom", "Communication", "kasmweb/zoom:1.18.0"),
  {
    id: "android-redroid",
    name: "Android",
    category: "Android",
    description: "Android workspace через Redroid/scrcpy.",
    availability: "requires-setup",
    launchStatus: "requires-setup",
    launchSurface: "kasm-ui",
    backend: { type: "android-redroid", image: "kasmweb/redroid:1.18.0" },
    defaults: desktop,
    requirements: ["binder_linux", "image-pull", "optional-gpu"],
    kasm: {
      friendlyName: "Android (Redroid)",
      imageSrc: "img/thumbnails/android.svg",
      dockerImage: "kasmweb/redroid:1.18.0",
      categories: ["Android", "Mobile", "Development"],
      runConfig: {
        environment: {
          ANDROID_VERSION: "15.0.0",
          REDROID_DISABLE_AUTOSTART: "0",
          REDROID_DISABLE_HOST_CHECKS: "0",
          REDROID_DPI: "320",
          REDROID_FPS: "30",
          REDROID_GPU_GUEST_MODE: "guest",
          REDROID_HEIGHT: "1280",
          REDROID_SHOW_CONSOLE: "1",
          REDROID_WIDTH: "720"
        },
        privileged: true
      },
      execConfig: {},
      persistentProfilePath: "/mnt/kasm_profiles/android-redroid/{username}"
    }
  },
  {
    id: "windows-rdp-existing",
    name: "Windows RDP",
    category: "Windows",
    description: "Подключиться к уже существующей Windows VM или Windows Server по RDP.",
    availability: "requires-setup",
    launchStatus: "manual",
    launchSurface: "external",
    backend: { type: "windows-rdp-existing" },
    defaults: desktop,
    requirements: ["rdp-host", "credentials-or-sso", "windows-license"]
  },
  {
    id: "windows-remoteapp",
    name: "Windows RemoteApp",
    category: "Windows",
    description: "Запускать конкретное Windows-приложение через RemoteApp.",
    availability: "requires-setup",
    launchStatus: "manual",
    launchSurface: "external",
    backend: { type: "windows-remoteapp" },
    defaults: standard,
    requirements: ["rdp-host", "remoteapp-path", "windows-license"]
  },
  {
    id: "windows-vm-create",
    name: "Create Windows VM",
    category: "Windows",
    description: "Создать Windows VM у настроенного provider и открыть ее через RDP.",
    availability: "requires-setup",
    launchStatus: "manual",
    launchSurface: "external",
    backend: { type: "windows-vm-create" },
    defaults: desktop,
    requirements: ["vm-provider", "windows-image", "windows-license"]
  },
  {
    id: "windows-wine",
    name: "Windows app via Wine",
    category: "Windows",
    description: "Wine Desktop в Kasm для установки и запуска простых Windows .exe/.msi.",
    availability: "requires-setup",
    launchStatus: "requires-setup",
    launchSurface: "kasm-ui",
    backend: { type: "wine-container", image: "docker-git-kasm-wine:1.18.0" },
    defaults: standard,
    requirements: ["kasm-runner", "wine-image", "persistent-profile"],
    kasm: {
      friendlyName: "Windows Apps (Wine)",
      imageSrc: "img/thumbnails/ubuntu.png",
      dockerImage: "docker-git-kasm-wine:1.18.0",
      categories: ["Windows", "Productivity", "Development"],
      runConfig: { hostname: "kasm" },
      execConfig: {},
      persistentProfilePath: "/mnt/kasm_profiles/windows-wine/{username}"
    }
  }
]

export const listWorkspaceOptions = (): ReadonlyArray<WorkspaceOption> => WORKSPACE_CATALOG

export const findWorkspaceOption = (id: string): Option.Option<WorkspaceOption> =>
  Option.fromNullable(WORKSPACE_CATALOG.find((option) => option.id === id))

export const resolveWorkspaceLaunch = (
  option: WorkspaceOption,
  input: LaunchWorkspaceInput
): Option.Option<CreateSessionInput> => {
  if (option.backend.type !== "webx11-container") return Option.none()
  return Option.some({
    name: input.name ?? option.name,
    image: option.backend.image,
    app: option.backend.app,
    resolution: input.resolution ?? option.defaults.resolution,
    resources: input.resources ?? option.defaults.resources,
    ttlSeconds: input.ttlSeconds ?? option.defaults.ttlSeconds
  })
}
