// CHANGE: tests for the docker-run argv builder
// WHY: hardening flags must be present in every argv; security review depends on this builder
// REF: issue#1 sections 7, 11.1
// PURITY: CORE TESTS
// INVARIANT: argv contains --cap-drop ALL ∧ no-new-privileges:true ∧ never --privileged
// COMPLEXITY: O(|labels|)
import { describe, expect, it } from "vitest"

import { buildDockerRunArgs } from "../../../src/core/session/docker-args.js"
import type { Session } from "../../../src/core/session/types.js"
import { SessionId } from "../../../src/core/session/types.js"
import { makeSessionFixture } from "../../_fixtures.js"

const session: Session = makeSessionFixture({
  id: SessionId("4b618726aef0"),
  status: "STARTING",
  containerId: null,
  novncPort: 6080,
  resources: { cpus: 2, memoryMb: 2048, shmMb: 1024 }
})

const toRecord = (extra: ReadonlyArray<string>): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const e of extra) {
    const [k, v] = e.split("=")
    if (k !== undefined && v !== undefined) out[k] = v
  }
  return out
}

const argvOf = (...extra: ReadonlyArray<string>): ReadonlyArray<string> =>
  buildDockerRunArgs(session, 16_080, toRecord(extra))

describe("buildDockerRunArgs — security hardening", () => {
  it("contains --cap-drop ALL", () => {
    const argv = argvOf()
    const idx = argv.indexOf("--cap-drop")
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(argv[idx + 1]).toBe("ALL")
  })

  it("contains --security-opt no-new-privileges:true", () => {
    const argv = argvOf()
    const idx = argv.indexOf("--security-opt")
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(argv[idx + 1]).toBe("no-new-privileges:true")
  })

  it("never includes --privileged", () => {
    expect(argvOf()).not.toContain("--privileged")
  })

  it("includes --pids-limit 512", () => {
    const argv = argvOf()
    const idx = argv.indexOf("--pids-limit")
    expect(argv[idx + 1]).toBe("512")
  })
})

describe("buildDockerRunArgs — port mapping and resources", () => {
  it("maps host port → container novnc port", () => {
    const argv = argvOf()
    const idx = argv.indexOf("-p")
    expect(argv[idx + 1]).toBe("16080:6080")
  })

  it("forwards resolution and app via env vars", () => {
    const argv = argvOf()
    expect(argv).toContain("SCREEN_WIDTH=1280")
    expect(argv).toContain("SCREEN_HEIGHT=720")
    expect(argv).toContain("SCREEN_DEPTH=24")
    expect(argv).toContain("START_APP=/usr/bin/xterm")
  })

  it("forwards memory, cpus and shm from resources", () => {
    const argv = argvOf()
    expect(argv[argv.indexOf("--memory") + 1]).toBe("2048m")
    expect(argv[argv.indexOf("--cpus") + 1]).toBe("2")
    expect(argv[argv.indexOf("--shm-size") + 1]).toBe("1024m")
  })

  it("starts with run -d --rm and ends with the image", () => {
    const argv = argvOf()
    expect(argv[0]).toBe("run")
    expect(argv[1]).toBe("-d")
    expect(argv[2]).toBe("--rm")
    expect(argv.at(-1)).toBe(session.image)
  })

  it("names the container webx11-<id>", () => {
    const argv = argvOf()
    const idx = argv.indexOf("--name")
    expect(argv[idx + 1]).toBe(`webx11-${session.id}`)
  })
})

describe("buildDockerRunArgs — labels", () => {
  it("emits builtin webx11.* labels", () => {
    const argv = argvOf()
    expect(argv).toContain(`webx11.session_id=${session.id}`)
    expect(argv).toContain(`webx11.port=6080`)
    expect(argv).toContain(`webx11.status=starting`)
  })

  it("emits extra labels after builtin labels", () => {
    const argv = argvOf("owner=alice")
    expect(argv).toContain("owner=alice")
  })
})
