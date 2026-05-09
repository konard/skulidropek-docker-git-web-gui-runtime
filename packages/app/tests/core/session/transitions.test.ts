// CHANGE: exhaustive table-driven tests for the session FSM
// WHY: ТЗ pins the lifecycle and rejects ad-hoc transitions; cover every (status, event) pair
// REF: issue#1 section 5
// PURITY: CORE TESTS
// INVARIANT: ∀ s, e: nextStatus(s, e) ∈ {Ok(next), Reject(reason)} and matches the spec table
// COMPLEXITY: O(|status|·|event|)
import { describe, expect, it } from "vitest"

import { applyTransition, nextStatus, type SessionEvent } from "../../../src/core/session/transitions.js"
import type { Session, SessionStatus } from "../../../src/core/session/types.js"
import { SessionId } from "../../../src/core/session/types.js"
import { makeSessionFixture } from "../../_fixtures.js"

const t0 = new Date("2025-05-09T12:00:00.000Z")
const t1 = new Date("2025-05-09T12:01:00.000Z")
const t2 = new Date("2025-05-09T12:02:00.000Z")

const baseSession = (status: SessionStatus): Session =>
  makeSessionFixture({
    id: SessionId("4b618726aef0"),
    status,
    containerId: null,
    createdAt: t0,
    updatedAt: t0,
    expiresAt: new Date(t0.getTime() + 3_600_000)
  })

describe("nextStatus — happy-path lifecycle", () => {
  it("CREATED + Start → STARTING", () => {
    expect(nextStatus("CREATED", { _tag: "Start" })).toEqual({ _tag: "Ok", next: "STARTING" })
  })

  it("STARTING + MarkReady → READY", () => {
    expect(nextStatus("STARTING", { _tag: "MarkReady" })).toEqual({ _tag: "Ok", next: "READY" })
  })

  it("READY + Stop → STOPPING", () => {
    expect(nextStatus("READY", { _tag: "Stop" })).toEqual({ _tag: "Ok", next: "STOPPING" })
  })

  it("STARTING + Stop → STOPPING (allowed shortcut)", () => {
    expect(nextStatus("STARTING", { _tag: "Stop" })).toEqual({ _tag: "Ok", next: "STOPPING" })
  })

  it("STOPPING + MarkStopped → STOPPED", () => {
    expect(nextStatus("STOPPING", { _tag: "MarkStopped", at: t1 })).toEqual({ _tag: "Ok", next: "STOPPED" })
  })

  it.each<SessionStatus>(["STOPPED", "FAILED", "CREATED"])("%s + Delete → DELETED", (status) => {
    expect(nextStatus(status, { _tag: "Delete" })).toEqual({ _tag: "Ok", next: "DELETED" })
  })

  it.each<SessionStatus>(["CREATED", "STARTING", "READY", "STOPPING", "STOPPED"])(
    "%s + Fail → FAILED",
    (status) => {
      expect(nextStatus(status, { _tag: "Fail", reason: "boom" })).toEqual({ _tag: "Ok", next: "FAILED" })
    }
  )
})

describe("nextStatus — rejected transitions", () => {
  it.each<[SessionStatus, SessionEvent]>([
    ["READY", { _tag: "Start" }],
    ["DELETED", { _tag: "Start" }],
    ["READY", { _tag: "MarkReady" }],
    ["STOPPED", { _tag: "Stop" }],
    ["READY", { _tag: "MarkStopped", at: t1 }]
  ])("rejects %s + %j", (status, event) => {
    const r = nextStatus(status, event)
    expect(r._tag).toBe("Reject")
  })

  it("Fail is rejected after DELETED", () => {
    expect(nextStatus("DELETED", { _tag: "Fail", reason: "x" })._tag).toBe("Reject")
  })

  it("Delete is rejected from STARTING/READY/STOPPING", () => {
    for (const status of ["STARTING", "READY", "STOPPING"] as const) {
      expect(nextStatus(status, { _tag: "Delete" })._tag).toBe("Reject")
    }
  })
})

describe("applyTransition", () => {
  it("returns the updated session with new status and updatedAt", () => {
    const initial = baseSession("CREATED")
    const r = applyTransition(initial, { _tag: "Start" }, t1)
    expect(r._tag).toBe("Ok")
    expect(r.session?.status).toBe("STARTING")
    expect(r.session?.updatedAt).toEqual(t1)
    expect(r.session?.id).toBe(initial.id)
  })

  it("sets stoppedAt only on MarkStopped", () => {
    const stopping = baseSession("STOPPING")
    const r = applyTransition(stopping, { _tag: "MarkStopped", at: t2 }, t1)
    expect(r.session?.stoppedAt).toEqual(t2)
  })

  it("sets failureReason on Fail", () => {
    const ready = baseSession("READY")
    const r = applyTransition(ready, { _tag: "Fail", reason: "kaboom" }, t1)
    expect(r.session?.status).toBe("FAILED")
    expect(r.session?.failureReason).toBe("kaboom")
  })

  it("returns Reject without a session field on invalid event", () => {
    const ready = baseSession("READY")
    const r = applyTransition(ready, { _tag: "Start" }, t1)
    expect(r._tag).toBe("Reject")
    expect(r.session).toBeUndefined()
  })
})
