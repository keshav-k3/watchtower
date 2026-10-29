import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeCtx } from "../test-helpers.js"

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0)
const HOUR = 60 * 60 * 1000

const loadPlugin = async () => {
  await import("./plugin.js")
  return globalThis.__watchtower_plugin
}

function withUsage(ctx, payload) {
  ctx.host.muse.usage.mockReturnValue(
    JSON.stringify({ status: "ok", stdout: typeof payload === "string" ? payload : JSON.stringify(payload) })
  )
}

describe("muse plugin", () => {
  beforeEach(() => {
    delete globalThis.__watchtower_plugin
    vi.resetModules()
  })

  it("shows the 5-hour window and weekly block from muse usage --json", async () => {
    const ctx = makeCtx()
    withUsage(ctx, {
      usage: {
        window: { usedPercent: 37.5, windowDurationMins: 300, resetsAtMs: NOW + 2 * HOUR },
        weekly: { usedPercent: 12, resetsAtMs: NOW + 72 * HOUR },
        tier: "muse_code_plus",
        observedAtMs: NOW,
      },
      tierName: "Muse Code Plus",
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)

    expect(ctx.host.muse.usage).toHaveBeenCalledTimes(1)
    expect(result.plan).toBe("Muse Code Plus")
    expect(result.lines).toEqual([
      {
        type: "progress",
        label: "Session",
        used: 37.5,
        limit: 100,
        format: { kind: "percent" },
        resetsAt: new Date(NOW + 2 * HOUR).toISOString(),
        periodDurationMs: 5 * HOUR,
      },
      {
        type: "progress",
        label: "Weekly",
        used: 12,
        limit: 100,
        format: { kind: "percent" },
        resetsAt: new Date(NOW + 72 * HOUR).toISOString(),
        periodDurationMs: 7 * 24 * HOUR,
      },
    ])
  })

  it("accepts the unwrapped camelCase usage object", async () => {
    const ctx = makeCtx()
    withUsage(ctx, {
      window: { usedPercent: 5, windowDurationMins: 300, resetsAtMs: NOW + HOUR },
      weekly: { usedPercent: 40, resetsAtMs: NOW + 24 * HOUR },
      tier: "plus",
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.plan).toBe("Plus")
    expect(result.lines.map((line) => [line.label, line.used])).toEqual([
      ["Session", 5],
      ["Weekly", 40],
    ])
  })

  it("accepts the snake_case subs_usage shape with ISO and epoch-second resets", async () => {
    const ctx = makeCtx()
    withUsage(ctx, {
      subs_tier_name: "Muse Code Pro",
      subs_usage: {
        window: { used_percent: 81, window_duration_mins: 300, resets_at: new Date(NOW + HOUR).toISOString() },
        weekly: { used_percent: 150, resets_at: Math.floor((NOW + 48 * HOUR) / 1000) },
      },
    })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.plan).toBe("Muse Code Pro")
    expect(result.lines[0]).toMatchObject({ label: "Session", used: 81, resetsAt: new Date(NOW + HOUR).toISOString() })
    expect(result.lines[1]).toMatchObject({ label: "Weekly", used: 100, resetsAt: new Date(NOW + 48 * HOUR).toISOString() })
  })

  it("shows only the blocks the CLI returned", async () => {
    const ctx = makeCtx()
    withUsage(ctx, { usage: { weekly: { usedPercent: 3 } } })
    const plugin = await loadPlugin()
    const result = plugin.probe(ctx)
    expect(result.plan).toBeNull()
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]).toMatchObject({ label: "Weekly", used: 3 })
    expect(result.lines[0].resetsAt).toBeUndefined()
  })

  it.each([
    ["not_installed", "Muse Code CLI not found"],
    ["not_logged_in", "Not logged in. Run `muse login`"],
    ["timed_out", "did not answer in time"],
    ["failed", "Muse usage request failed"],
  ])("throws a readable error when the CLI reports %s", async (status, message) => {
    const ctx = makeCtx()
    ctx.host.muse.usage.mockReturnValue(JSON.stringify({ status, message: "boom" }))
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow(message)
  })

  it("rejects output that is not JSON", async () => {
    const ctx = makeCtx()
    withUsage(ctx, "Tier: Plus\nWindow: 10% used, resets in 2h")
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("Muse usage response invalid")
  })

  it("explains when there is no subscription allowance", async () => {
    const ctx = makeCtx()
    withUsage(ctx, { status: "no_allowance" })
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("No Muse Code subscription allowance")
  })

  it("explains API-key logins", async () => {
    const ctx = makeCtx()
    withUsage(ctx, { status: "api_key" })
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("signed in with an API key")
  })

  it("fails clearly when the host has no muse API", async () => {
    const ctx = makeCtx()
    delete ctx.host.muse
    const plugin = await loadPlugin()
    expect(() => plugin.probe(ctx)).toThrow("not available in this Watchtower build")
  })
})
