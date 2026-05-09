// CHANGE: shared test fixtures (constants + helpers) to remove copy-paste across tests
// WHY: jscpd duplicate detection fails CI when the same fixture is defined in many files
// REF: issue#1 sections 4-9
// PURITY: TEST FIXTURES (no side effects)
// INVARIANT: every fixture is a pure value or a pure constructor
// COMPLEXITY: O(1)
import type { Session } from "../src/core/session/types.js"
import { ContainerId, SessionId } from "../src/core/session/types.js"

export const FIXED_ID = SessionId("aaaaaaaaaaaa")
export const FIXED_CONTAINER = ContainerId("c0ffee123456")
export const FIXED_NOW = new Date("2025-05-09T12:00:00.000Z")
export const FIXED_LATER = new Date("2025-05-09T13:00:00.000Z")

export const validCreatePayload = {
  name: "demo",
  image: "webx11/runtime:latest",
  app: "/usr/bin/xterm",
  resolution: { width: 1280, height: 720, depth: 24 },
  resources: { cpus: 1, memoryMb: 1024, shmMb: 256 },
  ttlSeconds: 3600
}

export const makeSessionFixture = (overrides: Partial<Session> = {}): Session => ({
  id: FIXED_ID,
  name: "demo",
  image: "webx11/runtime:latest",
  app: "/usr/bin/xterm",
  status: "READY",
  containerId: FIXED_CONTAINER,
  novncHost: "127.0.0.1",
  novncPort: 16_080,
  resolution: { width: 1280, height: 720, depth: 24 },
  resources: { cpus: 1, memoryMb: 1024, shmMb: 256 },
  ttlSeconds: 3600,
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
  expiresAt: FIXED_LATER,
  stoppedAt: null,
  failureReason: null,
  ...overrides
})
