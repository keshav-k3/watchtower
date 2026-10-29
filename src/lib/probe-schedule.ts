// Poll and countdown timing. Opening the panel still refreshes stale rows.

export const HIDDEN_POLL_FACTOR = 4
export const BATTERY_POLL_FACTOR = 2
export const MAX_POLL_INTERVAL_MS = 60 * 60_000

export function pollIntervalMs(
  baseMs: number,
  panelVisible: boolean,
  onBattery: boolean
): number {
  const hiddenFactor = panelVisible ? 1 : HIDDEN_POLL_FACTOR
  const batteryFactor = onBattery ? BATTERY_POLL_FACTOR : 1
  return Math.min(Math.max(0, baseMs) * hiddenFactor * batteryFactor, MAX_POLL_INTERVAL_MS)
}

type RefreshState = {
  lastUpdatedAt: number | null
}

// Refresh when opening the panel only after we already have a saved result
// that is older than the normal interval. The first load stays with bootstrap.
// A provider that never loaded (signed out, failing) does not count: it would
// re-probe every provider on every open. The normal poll still retries it.
export function shouldRefreshOnShow(
  states: RefreshState[],
  baseMs: number,
  nowMs: number
): boolean {
  return states.some(
    (state) => state.lastUpdatedAt != null && nowMs - state.lastUpdatedAt >= baseMs
  )
}

// Delay until the footer label text would change, instead of waking every second.
export function nextCountdownDelayMs(remainingMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 1000
  if (remainingMs > 60_000) {
    const intoMinute = remainingMs % 60_000
    return intoMinute === 0 ? 60_000 : intoMinute
  }
  const intoSecond = remainingMs % 1000
  return intoSecond === 0 ? 1000 : intoSecond
}
