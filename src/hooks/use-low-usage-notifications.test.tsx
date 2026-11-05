import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PluginState } from "@/hooks/app/types"
import type { MetricLine } from "@/lib/plugin-types"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

const { loadAlertsMock, loadAlertedMock, saveAlertedMock, sendMock } = vi.hoisted(() => ({
  loadAlertsMock: vi.fn(),
  loadAlertedMock: vi.fn(),
  saveAlertedMock: vi.fn(),
  sendMock: vi.fn(),
}))

vi.mock("@/lib/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings")>()
  return {
    ...actual,
    loadLowUsageAlerts: loadAlertsMock,
    loadLowUsageAlerted: loadAlertedMock,
    saveLowUsageAlerted: saveAlertedMock,
  }
})

vi.mock("@/lib/notify", () => ({ sendNativeNotification: sendMock }))

import { useLowUsageNotifications } from "@/hooks/use-low-usage-notifications"

function session(used: number): MetricLine {
  return { type: "progress", label: "Session", used, limit: 100, format: { kind: "percent" } }
}

function states(used: number | null): Record<string, PluginState> {
  return {
    codex: {
      data:
        used === null
          ? null
          : { providerId: "codex", displayName: "Codex", lines: [session(used)], iconUrl: "" },
      loading: false,
      error: null,
      lastManualRefreshAt: null,
      lastUpdatedAt: 1,
    },
  }
}

function Harness({ pluginStates }: { pluginStates: Record<string, PluginState> }) {
  useLowUsageNotifications(pluginStates)
  return null
}

describe("useLowUsageNotifications", () => {
  beforeEach(() => {
    useAppPreferencesStore.getState().resetState()
    loadAlertsMock.mockResolvedValue({ enabled: true, thresholdPercent: 10 })
    loadAlertedMock.mockResolvedValue([])
    saveAlertedMock.mockResolvedValue(undefined)
    sendMock.mockResolvedValue(undefined)
  })

  it("notifies once when a provider drops below the threshold, then again after it recovers", async () => {
    const { rerender } = render(<Harness pluginStates={states(50)} />)
    await waitFor(() => expect(useAppPreferencesStore.getState().lowUsageAlerts.enabled).toBe(true))
    expect(sendMock).not.toHaveBeenCalled()

    rerender(<Harness pluginStates={states(93)} />)
    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1))
    expect(sendMock).toHaveBeenCalledWith("Codex Is Running Low", "7% left on Session.")
    expect(saveAlertedMock).toHaveBeenLastCalledWith(["codex:Session"])

    rerender(<Harness pluginStates={states(96)} />)
    rerender(<Harness pluginStates={states(null)} />)
    expect(sendMock).toHaveBeenCalledTimes(1)

    rerender(<Harness pluginStates={states(2)} />)
    await waitFor(() => expect(saveAlertedMock).toHaveBeenLastCalledWith([]))
    rerender(<Harness pluginStates={states(95)} />)
    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(2))
  })

  it("does not repeat an alert sent before a relaunch", async () => {
    loadAlertedMock.mockResolvedValue(["codex:Session"])
    render(<Harness pluginStates={states(95)} />)
    await waitFor(() => expect(useAppPreferencesStore.getState().lowUsageAlerts.enabled).toBe(true))
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("stays quiet while the setting is off (the default)", async () => {
    loadAlertsMock.mockResolvedValue({ enabled: false, thresholdPercent: 10 })
    render(<Harness pluginStates={states(99)} />)
    await waitFor(() => expect(loadAlertedMock).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sendMock).not.toHaveBeenCalled()
    expect(saveAlertedMock).not.toHaveBeenCalled()
  })

  it("logs load and save failures without breaking", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    loadAlertsMock.mockRejectedValue(new Error("load"))
    useAppPreferencesStore.getState().setLowUsageAlerts({ enabled: true, thresholdPercent: 10 })
    saveAlertedMock.mockRejectedValue(new Error("save"))
    render(<Harness pluginStates={states(95)} />)
    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(consoleSpy).toHaveBeenCalledWith("Failed to save low usage alerts:", expect.any(Error))
    )
    expect(consoleSpy).toHaveBeenCalledWith("Failed to load low usage alerts:", expect.any(Error))
    consoleSpy.mockRestore()
  })

  it("ignores a load that finishes after unmount", async () => {
    let resolve: (value: unknown) => void = () => {}
    loadAlertsMock.mockReturnValue(new Promise((r) => { resolve = r }))
    const { unmount } = render(<Harness pluginStates={states(95)} />)
    unmount()
    resolve({ enabled: true, thresholdPercent: 30 })
    await new Promise((r) => setTimeout(r, 0))
    expect(useAppPreferencesStore.getState().lowUsageAlerts.thresholdPercent).toBe(10)
  })
})
