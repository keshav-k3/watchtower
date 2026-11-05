import { describe, expect, it } from "vitest"
import {
  BATTERY_POLL_FACTOR,
  HIDDEN_POLL_FACTOR,
  MAX_POLL_INTERVAL_MS,
  formatCountdown,
  isStale,
  nextCountdownDelayMs,
  nextRefreshRemainingMs,
  pollIntervalMs,
  shouldRefreshOnShow,
  staleAfterMs,
} from "@/lib/probe-schedule"

describe("pollIntervalMs", () => {
  const base = 5 * 60_000

  it("keeps the normal interval while the panel is open on power", () => {
    expect(pollIntervalMs(base, true, false)).toBe(base)
  })

  it("slows down when the panel is hidden", () => {
    expect(pollIntervalMs(base, false, false)).toBe(base * HIDDEN_POLL_FACTOR)
  })

  it("slows down on battery", () => {
    expect(pollIntervalMs(base, true, true)).toBe(base * BATTERY_POLL_FACTOR)
  })

  it("slows further when the panel is hidden and on battery", () => {
    expect(pollIntervalMs(base, false, true)).toBe(base * HIDDEN_POLL_FACTOR * BATTERY_POLL_FACTOR)
  })

  it("caps the wait at one hour", () => {
    expect(pollIntervalMs(60 * 60_000, false, true)).toBe(MAX_POLL_INTERVAL_MS)
  })

  it("treats a negative base as no wait", () => {
    expect(pollIntervalMs(-10, true, false)).toBe(0)
  })
})

describe("shouldRefreshOnShow", () => {
  const base = 5 * 60_000

  it("does not refresh before any result has been saved", () => {
    expect(shouldRefreshOnShow([], base, 10_000)).toBe(false)
    expect(shouldRefreshOnShow([{ lastUpdatedAt: null }], base, 10_000)).toBe(false)
  })

  it("does not refresh when every saved result is still fresh", () => {
    expect(
      shouldRefreshOnShow(
        [{ lastUpdatedAt: 8_000 }, { lastUpdatedAt: 9_000 }],
        base,
        10_000
      )
    ).toBe(false)
  })

  it("refreshes when a saved result is older than the normal interval", () => {
    expect(shouldRefreshOnShow([{ lastUpdatedAt: 0 }], base, base)).toBe(true)
  })

  it("does not refresh on open just because a provider never loaded", () => {
    expect(
      shouldRefreshOnShow(
        [{ lastUpdatedAt: 9_000 }, { lastUpdatedAt: null }],
        base,
        10_000
      )
    ).toBe(false)
    expect(
      shouldRefreshOnShow(
        [{ lastUpdatedAt: 0 }, { lastUpdatedAt: null }],
        base,
        base
      )
    ).toBe(true)
  })
})

describe("nextCountdownDelayMs", () => {
  it("waits until the next minute boundary while the label is in minutes", () => {
    expect(nextCountdownDelayMs(90_000)).toBe(30_000)
    expect(nextCountdownDelayMs(120_000)).toBe(60_000)
  })

  it("waits until the next second while the label is in seconds", () => {
    expect(nextCountdownDelayMs(30_000)).toBe(1_000)
    expect(nextCountdownDelayMs(1_500)).toBe(500)
  })

  it("uses one second when the countdown is already due or invalid", () => {
    expect(nextCountdownDelayMs(0)).toBe(1_000)
    expect(nextCountdownDelayMs(-5)).toBe(1_000)
    expect(nextCountdownDelayMs(Number.NaN)).toBe(1_000)
    expect(nextCountdownDelayMs(Number.POSITIVE_INFINITY)).toBe(1_000)
  })
})

describe("formatCountdown", () => {
  it("shows seconds under a minute", () => {
    expect(formatCountdown(45_000)).toBe("45s")
    expect(formatCountdown(1_500)).toBe("2s")
    expect(formatCountdown(0)).toBe("0s")
    expect(formatCountdown(-10)).toBe("0s")
  })

  it("shows minutes under an hour, rounding up", () => {
    expect(formatCountdown(60_000)).toBe("1m")
    expect(formatCountdown(4 * 60_000)).toBe("4m")
    expect(formatCountdown(4 * 60_000 + 1)).toBe("5m")
    expect(formatCountdown(59 * 60_000)).toBe("59m")
  })

  it("switches to hours and minutes instead of a long minute count", () => {
    expect(formatCountdown(59 * 60_000 + 1)).toBe("1h")
    expect(formatCountdown(65 * 60_000)).toBe("1h 5m")
    expect(formatCountdown(1667 * 60_000)).toBe("27h 47m")
  })
})

describe("nextRefreshRemainingMs", () => {
  it("counts down from a fresh clock reading", () => {
    expect(nextRefreshRemainingMs(1_000_000 + 5 * 60_000, 1_000_000)).toBe(5 * 60_000)
  })

  it("never goes below zero once the refresh is due", () => {
    expect(nextRefreshRemainingMs(1_000_000, 1_000_500)).toBe(0)
  })

  it("is only as long as the gap when the clock reading is stale (the 1667m report)", () => {
    // Panel hid ~27.7h ago; the poll was re-armed for 5m on show.
    const shownAt = 1_000_000_000
    const hiddenAt = shownAt - (1667 - 5) * 60_000
    const nextAt = shownAt + 5 * 60_000
    expect(formatCountdown(nextRefreshRemainingMs(nextAt, hiddenAt))).toBe("27h 47m")
    expect(formatCountdown(nextRefreshRemainingMs(nextAt, shownAt))).toBe("5m")
  })
})

describe("isStale", () => {
  const base = 5 * 60_000
  const now = 10 * 60 * 60_000

  it("allows two of the slowest normal polls before numbers count as old", () => {
    expect(staleAfterMs(base)).toBe(80 * 60_000)
    expect(staleAfterMs(30 * 60_000)).toBe(2 * MAX_POLL_INTERVAL_MS)
  })

  it("keeps a recent result fresh, even across a hidden-panel gap", () => {
    expect(isStale({ lastUpdatedAt: now - 40 * 60_000, loading: false, error: null }, base, now)).toBe(false)
  })

  it("marks a result older than the limit as stale", () => {
    expect(isStale({ lastUpdatedAt: now - 3 * 60 * 60_000, loading: false, error: null }, base, now)).toBe(true)
  })

  it("marks shown numbers stale as soon as the latest refresh failed", () => {
    expect(isStale({ lastUpdatedAt: now - 60_000, loading: false, error: "offline" }, base, now)).toBe(true)
  })

  it("never marks a card stale while it refreshes or before it ever loaded", () => {
    expect(isStale({ lastUpdatedAt: now - 3 * 60 * 60_000, loading: true, error: null }, base, now)).toBe(false)
    expect(isStale({ lastUpdatedAt: null, loading: false, error: "signed out" }, base, now)).toBe(false)
  })
})
