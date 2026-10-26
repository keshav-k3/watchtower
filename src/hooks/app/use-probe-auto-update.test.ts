import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getEnabledPluginIdsMock, invokeMock, isTauriMock } = vi.hoisted(() => ({
  getEnabledPluginIdsMock: vi.fn(),
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(() => false),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}))

vi.mock("@/lib/settings", () => ({
  getEnabledPluginIds: getEnabledPluginIdsMock,
}))

import { useProbeAutoUpdate } from "@/hooks/app/use-probe-auto-update"

describe("useProbeAutoUpdate", () => {
  beforeEach(() => {
    getEnabledPluginIdsMock.mockReset()
    invokeMock.mockReset()
    isTauriMock.mockReset()
    isTauriMock.mockReturnValue(false)
    getEnabledPluginIdsMock.mockImplementation((settings: { order: string[]; disabled: string[] }) =>
      settings.order.filter((id) => !settings.disabled.includes(id))
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("keeps auto-update cleared when plugin settings are missing", () => {
    const { result } = renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: null,
        autoUpdateInterval: 15,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        isPluginLoading: vi.fn(() => false),
        startBatch: vi.fn(),
      })
    )

    act(() => {
      result.current.resetAutoUpdateSchedule()
    })

    expect(result.current.autoUpdateNextAt).toBeNull()
  })

  it("resets the schedule when ordered plugins are present", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000)

    const { result } = renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["codex"], disabled: [] },
        autoUpdateInterval: 15,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        isPluginLoading: vi.fn(() => false),
        startBatch: vi.fn(),
      })
    )

    act(() => {
      result.current.resetAutoUpdateSchedule()
    })

    expect(result.current.autoUpdateNextAt).toBe(910_000)
    nowSpy.mockRestore()
  })

  it("skips providers that are still loading when auto-update fires", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)

    const setLoadingForPlugins = vi.fn()
    const setErrorForPlugins = vi.fn()
    const startBatch = vi.fn().mockResolvedValue(["idle"])
    const isPluginLoading = vi.fn((id: string) => id === "slow")

    renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["slow", "idle"], disabled: [] },
        autoUpdateInterval: 15,
        setLoadingForPlugins,
        setErrorForPlugins,
        isPluginLoading,
        startBatch,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000)
    })

    expect(isPluginLoading).toHaveBeenCalledWith("slow")
    expect(isPluginLoading).toHaveBeenCalledWith("idle")
    expect(setLoadingForPlugins).toHaveBeenCalledWith(["idle"])
    expect(startBatch).toHaveBeenCalledWith(["idle"])
    expect(setErrorForPlugins).not.toHaveBeenCalled()
  })

  it("clears a reset schedule when every provider is disabled", () => {
    const { result } = renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["codex"], disabled: ["codex"] },
        autoUpdateInterval: 15,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        isPluginLoading: vi.fn(() => false),
        startBatch: vi.fn(),
      })
    )

    act(() => {
      result.current.resetAutoUpdateSchedule()
    })

    expect(result.current.autoUpdateNextAt).toBeNull()
  })

  it("clears the schedule when every provider is disabled", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000)

    const { result } = renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["codex", "claude"], disabled: ["codex", "claude"] },
        autoUpdateInterval: 15,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        isPluginLoading: vi.fn(() => false),
        startBatch: vi.fn(),
      })
    )

    expect(result.current.autoUpdateNextAt).toBeNull()
    nowSpy.mockRestore()
  })

  it("logs and sets errors when auto-update batch start fails", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)

    const failure = new Error("batch failed")
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const setLoadingForPlugins = vi.fn()
    const setErrorForPlugins = vi.fn()
    const startBatch = vi.fn().mockRejectedValue(failure)

    renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["codex"], disabled: [] },
        autoUpdateInterval: 15,
        setLoadingForPlugins,
        setErrorForPlugins,
        isPluginLoading: vi.fn(() => false),
        startBatch,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000)
    })

    expect(setErrorForPlugins).toHaveBeenCalledWith(["codex"], "Failed to start probe")
    expect(errorSpy).toHaveBeenCalledWith("Failed to start auto-update batch:", failure)
    errorSpy.mockRestore()
  })

  it("does not start an auto-update batch when every provider is still loading", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)

    const setLoadingForPlugins = vi.fn()
    const setErrorForPlugins = vi.fn()
    const startBatch = vi.fn()

    const { result } = renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["slow"], disabled: [] },
        autoUpdateInterval: 15,
        setLoadingForPlugins,
        setErrorForPlugins,
        isPluginLoading: vi.fn(() => true),
        startBatch,
      })
    )

    expect(result.current.autoUpdateNextAt).toBe(910_000)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000)
    })

    expect(result.current.autoUpdateNextAt).toBe(1_810_000)
    expect(setLoadingForPlugins).not.toHaveBeenCalled()
    expect(startBatch).not.toHaveBeenCalled()
    expect(setErrorForPlugins).not.toHaveBeenCalled()
  })

  it("waits longer while the panel is hidden", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const startBatch = vi.fn().mockResolvedValue(["codex"])

    renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["codex"], disabled: [] },
        autoUpdateInterval: 15,
        panelVisible: false,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        isPluginLoading: vi.fn(() => false),
        startBatch,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000)
    })
    expect(startBatch).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45 * 60_000)
    })
    expect(startBatch).toHaveBeenCalledWith(["codex"])
  })

  it("does not refresh on open when no staleness check is provided", () => {
    const startBatch = vi.fn()
    const { rerender } = renderHook(
      ({ visible }: { visible: boolean }) =>
        useProbeAutoUpdate({
          pluginSettings: { order: ["codex"], disabled: [] },
          autoUpdateInterval: 15,
          panelVisible: visible,
          setLoadingForPlugins: vi.fn(),
          setErrorForPlugins: vi.fn(),
          isPluginLoading: () => false,
          startBatch,
        }),
      { initialProps: { visible: false } }
    )

    rerender({ visible: true })
    expect(startBatch).not.toHaveBeenCalled()
  })

  it("refreshes stale data when the panel opens and leaves fresh data alone", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const startBatch = vi.fn().mockResolvedValue(["codex"])

    const { rerender } = renderHook(
      ({ visible, stale }: { visible: boolean; stale: boolean }) =>
        useProbeAutoUpdate({
          pluginSettings: { order: ["codex"], disabled: [] },
          autoUpdateInterval: 15,
          panelVisible: visible,
          isDataStale: () => stale,
          setLoadingForPlugins: vi.fn(),
          setErrorForPlugins: vi.fn(),
          isPluginLoading: () => false,
          startBatch,
        }),
      { initialProps: { visible: false, stale: false } }
    )

    rerender({ visible: true, stale: false })
    expect(startBatch).not.toHaveBeenCalled()

    rerender({ visible: false, stale: true })
    rerender({ visible: true, stale: true })
    expect(startBatch).toHaveBeenCalledWith(["codex"])
  })

  it("lengthens the wait when the computer is on battery", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    isTauriMock.mockReturnValue(true)
    invokeMock.mockResolvedValue({ onBattery: true })
    const startBatch = vi.fn().mockResolvedValue(["codex"])

    const { result } = renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["codex"], disabled: [] },
        autoUpdateInterval: 15,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        isPluginLoading: () => false,
        startBatch,
      })
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.autoUpdateNextAt).toBe(10_000 + 30 * 60_000)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000)
    })
    expect(startBatch).not.toHaveBeenCalled()
  })

  it("keeps the current wait when power status is unchanged or unreadable", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    isTauriMock.mockReturnValue(true)
    invokeMock.mockResolvedValue({})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const { result, unmount } = renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["codex"], disabled: [] },
        autoUpdateInterval: 15,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        isPluginLoading: () => false,
        startBatch: vi.fn(),
      })
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.autoUpdateNextAt).toBe(10_000 + 15 * 60_000)

    invokeMock.mockRejectedValueOnce(new Error("power failed"))
    result.current.resetAutoUpdateSchedule()
    await act(async () => {
      await Promise.resolve()
    })
    expect(errorSpy).toHaveBeenCalledWith("Failed to read power status:", expect.any(Error))
    unmount()
    errorSpy.mockRestore()
  })

  it("ignores a late power reading after unmount", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    isTauriMock.mockReturnValue(true)
    let resolvePower: ((value: { onBattery: boolean }) => void) | undefined
    invokeMock.mockReturnValue(new Promise((resolve) => {
      resolvePower = resolve
    }))

    const { unmount } = renderHook(() =>
      useProbeAutoUpdate({
        pluginSettings: { order: ["codex"], disabled: [] },
        autoUpdateInterval: 15,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        isPluginLoading: () => false,
        startBatch: vi.fn(),
      })
    )

    unmount()
    resolvePower?.({ onBattery: true })
    await act(async () => {
      await Promise.resolve()
    })
  })
})
