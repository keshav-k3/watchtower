import type { MetricLine } from "@/lib/plugin-types"

export type LowUsageProvider = {
  providerId: string
  name: string
  lines: MetricLine[]
}

export type LowUsageAlert = {
  providerId: string
  title: string
  body: string
}

export type LowUsageResult = {
  alerts: LowUsageAlert[]
  alerted: string[]
}

function percentLeft(used: number, limit: number): number {
  return Math.max(0, ((limit - used) / limit) * 100)
}

// One key per limit (provider + line). A limit alerts once when it drops below
// the threshold and is quiet until it climbs back above it, which is what a
// reset does. Reset times are left out of the key on purpose: some providers
// report them relative to "now", so they shift on every refresh.
export function detectLowUsage(
  alreadyAlerted: string[],
  providers: LowUsageProvider[],
  thresholdPercent: number
): LowUsageResult {
  const alerted = new Set(alreadyAlerted)
  const alerts: LowUsageAlert[] = []

  for (const provider of providers) {
    const crossed: string[] = []
    for (const line of provider.lines) {
      if (line.type !== "progress" || !(line.limit > 0)) continue
      const key = `${provider.providerId}:${line.label}`
      const left = percentLeft(line.used, line.limit)
      if (left >= thresholdPercent) {
        alerted.delete(key)
        continue
      }
      if (alerted.has(key)) continue
      alerted.add(key)
      crossed.push(`${Math.floor(left)}% left on ${line.label}`)
    }
    if (crossed.length > 0) {
      alerts.push({
        providerId: provider.providerId,
        title: `${provider.name} Is Running Low`,
        body: `${crossed.join(", ")}.`,
      })
    }
  }

  return { alerts, alerted: [...alerted].sort() }
}
