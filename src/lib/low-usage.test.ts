import { describe, expect, it } from "vitest"
import { detectLowUsage, type LowUsageProvider } from "@/lib/low-usage"
import type { MetricLine } from "@/lib/plugin-types"

function progress(label: string, used: number, limit = 100): MetricLine {
  return { type: "progress", label, used, limit, format: { kind: "percent" } }
}

function codex(...lines: MetricLine[]): LowUsageProvider {
  return { providerId: "codex", name: "Codex", lines }
}

describe("detectLowUsage", () => {
  it("alerts once when a limit drops below the threshold", () => {
    const first = detectLowUsage([], [codex(progress("Session", 92), progress("Weekly", 40))], 10)
    expect(first.alerts).toEqual([
      { providerId: "codex", title: "Codex Is Running Low", body: "8% left on Session." },
    ])
    expect(first.alerted).toEqual(["codex:Session"])

    const again = detectLowUsage(first.alerted, [codex(progress("Session", 97))], 10)
    expect(again.alerts).toEqual([])
    expect(again.alerted).toEqual(["codex:Session"])
  })

  it("alerts again only after the limit recovers, e.g. after a reset", () => {
    const recovered = detectLowUsage(["codex:Session"], [codex(progress("Session", 3))], 10)
    expect(recovered.alerts).toEqual([])
    expect(recovered.alerted).toEqual([])

    const low = detectLowUsage(recovered.alerted, [codex(progress("Session", 95))], 10)
    expect(low.alerts).toHaveLength(1)
  })

  it("groups several low limits into one notification per provider", () => {
    const result = detectLowUsage(
      [],
      [
        codex(progress("Session", 95), progress("Weekly", 99.5)),
        { providerId: "cursor", name: "Cursor", lines: [progress("Plan", 18, 20)] },
      ],
      10
    )
    // Cursor sits exactly at 10% left: that is not below the threshold.
    expect(result.alerts).toEqual([
      { providerId: "codex", title: "Codex Is Running Low", body: "5% left on Session, 0% left on Weekly." },
    ])
    expect(result.alerted).toEqual(["codex:Session", "codex:Weekly"])
  })

  it("ignores text lines, limits without a size, and overspent limits stay at 0%", () => {
    const result = detectLowUsage(
      [],
      [
        codex(
          { type: "text", label: "Credits", value: "$4" },
          progress("Unlimited", 50, 0),
          progress("Over", 130)
        ),
      ],
      10
    )
    expect(result.alerts).toEqual([
      { providerId: "codex", title: "Codex Is Running Low", body: "0% left on Over." },
    ])
  })
})
