import type { MetricLine, PluginOutput } from "@/lib/plugin-types"
import type { PluginState } from "@/hooks/app/types"

export type CachedUsageSnapshot = {
  providerId?: unknown
  displayName?: unknown
  plan?: unknown
  lines?: unknown
  fetchedAt?: unknown
}

export function cachedUsageToStates(entries: unknown): Record<string, PluginState> {
  if (!Array.isArray(entries)) return {}
  const states: Record<string, PluginState> = {}
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue
    const snapshot = entry as CachedUsageSnapshot
    if (typeof snapshot.providerId !== "string" || snapshot.providerId.length === 0) continue
    if (!Array.isArray(snapshot.lines)) continue
    const fetchedAt =
      typeof snapshot.fetchedAt === "string" ? Date.parse(snapshot.fetchedAt) : Number.NaN
    const output: PluginOutput = {
      providerId: snapshot.providerId,
      displayName:
        typeof snapshot.displayName === "string" && snapshot.displayName.length > 0
          ? snapshot.displayName
          : snapshot.providerId,
      lines: snapshot.lines as MetricLine[],
      iconUrl: "",
    }
    if (typeof snapshot.plan === "string" && snapshot.plan.length > 0) {
      output.plan = snapshot.plan
    }
    states[snapshot.providerId] = {
      data: output,
      loading: false,
      error: null,
      lastManualRefreshAt: null,
      lastUpdatedAt: Number.isFinite(fetchedAt) ? fetchedAt : null,
    }
  }
  return states
}
