import { describe, expect, it } from "vitest"
import {
  codexResetMessage,
  codexWindowsFromLines,
  detectCodexResets,
  type CodexWindowSnapshot,
} from "@/lib/codex-reset"
import type { MetricLine } from "@/lib/plugin-types"

const session = (used: number, resetsAt: string): MetricLine => ({
  type: "progress",
  label: "Session",
  used,
  limit: 100,
  format: { kind: "percent" },
  resetsAt,
})

describe("codex reset detection", () => {
  it("reads session and weekly windows, including labelled accounts", () => {
    const windows = codexWindowsFromLines([
      session(40, "2026-10-26T12:00:00.000Z"),
      {
        type: "progress",
        label: "Work · Weekly",
        used: 80,
        limit: 100,
        format: { kind: "percent" },
        resetsAt: "not-a-date",
      },
      { type: "text", label: "Credits", value: "$1" },
      {
        type: "progress",
        label: "Reviews",
        used: 1,
        limit: 100,
        format: { kind: "percent" },
      },
      {
        type: "progress",
        label: " · Session",
        used: 3,
        limit: 100,
        format: { kind: "count", suffix: "credits" },
      },
    ])
    expect(windows).toEqual([
      {
        account: "Codex",
        kind: "session",
        usedPercent: 40,
        resetAtMs: Date.parse("2026-10-26T12:00:00.000Z"),
      },
      {
        account: "Work",
        kind: "weekly",
        usedPercent: 80,
        resetAtMs: null,
      },
    ])
  })

  it("does not alert on the first sample", () => {
    const next: CodexWindowSnapshot[] = [
      { account: "Codex", kind: "session", usedPercent: 10, resetAtMs: 2_000 },
    ]
    expect(detectCodexResets(null, next)).toEqual([])
  })

  it("alerts when usage drops and the reset time jumps earlier", () => {
    const previous: CodexWindowSnapshot[] = [
      { account: "Work", kind: "session", usedPercent: 70, resetAtMs: 5_000_000 },
      { account: "Work", kind: "weekly", usedPercent: 40, resetAtMs: 9_000_000 },
    ]
    const next: CodexWindowSnapshot[] = [
      { account: "Work", kind: "session", usedPercent: 2, resetAtMs: 1_000_000 },
      { account: "Work", kind: "weekly", usedPercent: 39, resetAtMs: 9_000_000 },
    ]
    expect(detectCodexResets(previous, next)).toEqual(["Codex (Work) limits were reset"])
  })

  it("alerts when a window rolls forward", () => {
    const previous: CodexWindowSnapshot[] = [
      { account: "Codex", kind: "weekly", usedPercent: 55, resetAtMs: 1_000_000 },
    ]
    const next: CodexWindowSnapshot[] = [
      { account: "Codex", kind: "weekly", usedPercent: 1, resetAtMs: 2_000_000 },
    ]
    expect(detectCodexResets(previous, next)).toEqual(["Codex limits were reset"])
    expect(codexResetMessage("")).toBe("Codex limits were reset")
  })

  it("ignores a drop that keeps the same reset time", () => {
    const previous: CodexWindowSnapshot[] = [
      { account: "Codex", kind: "session", usedPercent: 50, resetAtMs: 5_000_000 },
    ]
    const next: CodexWindowSnapshot[] = [
      { account: "Codex", kind: "session", usedPercent: 10, resetAtMs: 5_000_000 },
    ]
    expect(detectCodexResets(previous, next)).toEqual([])
  })

  it("treats a drop to zero without timestamps as a reset", () => {
    const previous: CodexWindowSnapshot[] = [
      { account: "Personal", kind: "session", usedPercent: 30, resetAtMs: null },
    ]
    const next: CodexWindowSnapshot[] = [
      { account: "Personal", kind: "session", usedPercent: 0, resetAtMs: null },
    ]
    expect(detectCodexResets(previous, next)).toEqual(["Codex (Personal) limits were reset"])
  })

  it("accepts a halved window and a blank account prefix", () => {
    const windows = codexWindowsFromLines([
      {
        type: "progress",
        label: " · Session",
        used: 4,
        limit: 100,
        format: { kind: "percent" },
      },
      {
        type: "progress",
        label: " · Weekly",
        used: 5,
        limit: 100,
        format: { kind: "percent" },
      },
    ])
    expect(windows[0]?.account).toBe("Codex")
    expect(windows[1]?.account).toBe("Codex")
    const previous: CodexWindowSnapshot[] = [
      { account: "Codex", kind: "session", usedPercent: 22, resetAtMs: 5_000_000 },
      { account: "Codex", kind: "weekly", usedPercent: 30, resetAtMs: null },
    ]
    const next: CodexWindowSnapshot[] = [
      { account: "Codex", kind: "session", usedPercent: 10, resetAtMs: 1_000_000 },
      { account: "Codex", kind: "weekly", usedPercent: 10, resetAtMs: null },
    ]
    expect(detectCodexResets(previous, next)).toEqual(["Codex limits were reset"])
  })

  it("ignores a new account that has no previous sample", () => {
    const previous: CodexWindowSnapshot[] = [
      { account: "Codex", kind: "session", usedPercent: 10, resetAtMs: 1 },
    ]
    const next: CodexWindowSnapshot[] = [
      { account: "Work", kind: "session", usedPercent: 0, resetAtMs: 2 },
    ]
    expect(detectCodexResets(previous, next)).toEqual([])
  })
})
