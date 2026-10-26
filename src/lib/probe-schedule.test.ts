import { describe, expect, it } from "vitest"
import {
  BATTERY_POLL_FACTOR,
  HIDDEN_POLL_FACTOR,
  MAX_POLL_INTERVAL_MS,
  nextCountdownDelayMs,
  pollIntervalMs,
  shouldRefreshOnShow,
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

  it("refreshes when one provider has never loaded and another has", () => {
    expect(
      shouldRefreshOnShow(
        [{ lastUpdatedAt: 9_000 }, { lastUpdatedAt: null }],
        base,
        10_000
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
