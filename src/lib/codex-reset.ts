import type { MetricLine } from "@/lib/plugin-types"

export type CodexWindowSnapshot = {
  account: string
  kind: "session" | "weekly"
  usedPercent: number
  resetAtMs: number | null
}

const ACCOUNT_MARKER = " · "
const DROP_POINTS = 15

export function codexWindowsFromLines(lines: MetricLine[]): CodexWindowSnapshot[] {
  const windows: CodexWindowSnapshot[] = []
  for (const line of lines) {
    if (line.type !== "progress") continue
    if (line.format.kind !== "percent") continue
    const parsed = parseCodexWindowLabel(line.label)
    if (!parsed) continue
    const resetAtMs = line.resetsAt ? Date.parse(line.resetsAt) : Number.NaN
    windows.push({
      account: parsed.account,
      kind: parsed.kind,
      usedPercent: line.used,
      resetAtMs: Number.isFinite(resetAtMs) ? resetAtMs : null,
    })
  }
  return windows
}

function parseCodexWindowLabel(label: string): { account: string; kind: "session" | "weekly" } | null {
  const index = label.lastIndexOf(ACCOUNT_MARKER)
  const metric = index === -1 ? label : label.slice(index + ACCOUNT_MARKER.length)
  const account = index === -1 ? "Codex" : label.slice(0, index).trim()
  if (metric === "Session") return { account: account || "Codex", kind: "session" }
  if (metric === "Weekly") return { account: account || "Codex", kind: "weekly" }
  return null
}

export function codexResetMessage(account: string): string {
  if (!account || account === "Codex") return "Codex limits were reset"
  return `Codex (${account}) limits were reset`
}

// A window that passed its scheduled reset time rolls over on its own every
// session or week. Only an early reset (before the scheduled time) is news.
const SCHEDULE_SLACK_MS = 60_000

function windowWasReset(
  previous: CodexWindowSnapshot,
  next: CodexWindowSnapshot,
  nowMs: number,
): boolean {
  if (previous.resetAtMs != null && nowMs >= previous.resetAtMs - SCHEDULE_SLACK_MS) return false
  const drop = previous.usedPercent - next.usedPercent
  const largeDrop = drop >= DROP_POINTS || (previous.usedPercent >= 20 && next.usedPercent <= previous.usedPercent * 0.5)
  if (!largeDrop) return false
  if (previous.resetAtMs != null && next.resetAtMs != null) {
    if (next.resetAtMs + 60_000 < previous.resetAtMs) return true
    if (next.resetAtMs > previous.resetAtMs + 60_000) return true
    return false
  }
  return next.usedPercent <= 5 && drop >= 20
}

export function detectCodexResets(
  previous: CodexWindowSnapshot[] | null,
  next: CodexWindowSnapshot[],
  nowMs: number = Date.now(),
): string[] {
  if (!previous) return []
  const prior = new Map(previous.map((window) => [`${window.account}:${window.kind}`, window]))
  const accounts = new Set<string>()
  for (const window of next) {
    const before = prior.get(`${window.account}:${window.kind}`)
    if (!before) continue
    if (windowWasReset(before, window, nowMs)) accounts.add(window.account)
  }
  return Array.from(accounts).map(codexResetMessage)
}
