import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getEnabledPluginIdsMock } = vi.hoisted(() => ({
  getEnabledPluginIdsMock: vi.fn(),
}))

vi.mock("@/lib/settings", () => ({
  REFRESH_COOLDOWN_MS: 300_000,
  getEnabledPluginIds: getEnabledPluginIdsMock,
}))

import { useProbeRefreshActions } from "@/hooks/app/use-probe-refresh-actions"

describe("useProbeRefreshActions", () => {
  beforeEach(() => {
    getEnabledPluginIdsMock.mockReset()
    getEnabledPluginIdsMock.mockImplementation((settings: { order: string[]; disabled: string[] }) =>
      settings.order.filter((id) => !settings.disabled.includes(id))
    )
  })

  it("returns early when retry is blocked by loading, manual refresh, or cooldown", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    const startBatch = vi.fn()
    const resetAutoUpdateSchedule = vi.fn()

    const { result } = renderHook(() =>
      useProbeRefreshActions({
        pluginSettings: { order: ["codex"], disabled: [] },
        pluginStatesRef: {
          current: {
            codex: {
              data: null,
              loading: true,
              error: null,
              lastManualRefreshAt: null,
              lastUpdatedAt: null,
            },
          },
        },
        manualRefreshIdsRef: { current: new Set<string>() },
        resetAutoUpdateSchedule,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        startBatch,
      })
    )

    act(() => {
      result.current.handleRetryPlugin("codex")
    })
    expect(startBatch).not.toHaveBeenCalled()

    const manualRefreshIdsRef = { current: new Set<string>(["codex"]) }
    const { result: manualResult } = renderHook(() =>
      useProbeRefreshActions({
        pluginSettings: { order: ["codex"], disabled: [] },
        pluginStatesRef: { current: {} },
        manualRefreshIdsRef,
        resetAutoUpdateSchedule,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        startBatch,
      })
    )

    act(() => {
      manualResult.current.handleRetryPlugin("codex")
    })
    expect(startBatch).not.toHaveBeenCalled()

    const { result: cooldownResult } = renderHook(() =>
      useProbeRefreshActions({
        pluginSettings: { order: ["codex"], disabled: [] },
        pluginStatesRef: {
          current: {
            codex: {
              data: null,
              loading: false,
              error: null,
              lastManualRefreshAt: 900_001,
              lastUpdatedAt: null,
            },
          },
        },
        manualRefreshIdsRef: { current: new Set<string>() },
        resetAutoUpdateSchedule,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        startBatch,
      })
    )

    act(() => {
      cooldownResult.current.handleRetryPlugin("codex")
    })
    expect(startBatch).not.toHaveBeenCalled()
    nowSpy.mockRestore()
  })

  it("returns early when refresh-all has no eligible plugins", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    const startBatch = vi.fn()
    const resetAutoUpdateSchedule = vi.fn()

    const { result } = renderHook(() =>
      useProbeRefreshActions({
        pluginSettings: { order: ["codex"], disabled: [] },
        pluginStatesRef: {
          current: {
            codex: {
              data: null,
              loading: true,
              error: null,
              lastManualRefreshAt: null,
              lastUpdatedAt: null,
            },
          },
        },
        manualRefreshIdsRef: { current: new Set<string>(["codex"]) },
        resetAutoUpdateSchedule,
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        startBatch,
      })
    )

    act(() => {
      result.current.handleRefreshAll()
    })

    expect(startBatch).not.toHaveBeenCalled()
    expect(resetAutoUpdateSchedule).not.toHaveBeenCalled()
    nowSpy.mockRestore()
  })

  it("retries one plugin via manual refresh", () => {
    const manualRefreshIdsRef = { current: new Set<string>() }
    const startBatch = vi.fn().mockResolvedValue(undefined)
    const setLoadingForPlugins = vi.fn()

    const { result } = renderHook(() =>
      useProbeRefreshActions({
        pluginSettings: { order: ["codex"], disabled: [] },
        pluginStatesRef: { current: {} },
        manualRefreshIdsRef,
        resetAutoUpdateSchedule: vi.fn(),
        setLoadingForPlugins,
        setErrorForPlugins: vi.fn(),
        startBatch,
      })
    )

    act(() => {
      result.current.handleRetryPlugin("codex")
    })

    expect(setLoadingForPlugins).toHaveBeenCalledWith(["codex"])
    expect(startBatch).toHaveBeenCalledWith(["codex"])
    expect(manualRefreshIdsRef.current.has("codex")).toBe(true)
  })

  it("includes plugins whose manual refresh cooldown has elapsed", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    const startBatch = vi.fn().mockResolvedValue(undefined)
    const setLoadingForPlugins = vi.fn()

    const { result } = renderHook(() =>
      useProbeRefreshActions({
        pluginSettings: { order: ["codex"], disabled: [] },
        pluginStatesRef: {
          current: {
            codex: {
              data: null,
              loading: false,
              error: null,
              lastManualRefreshAt: 1_000_000 - 300_000,
              lastUpdatedAt: null,
            },
          },
        },
        manualRefreshIdsRef: { current: new Set<string>() },
        resetAutoUpdateSchedule: vi.fn(),
        setLoadingForPlugins,
        setErrorForPlugins: vi.fn(),
        startBatch,
      })
    )

    act(() => {
      result.current.handleRefreshAll()
    })

    expect(setLoadingForPlugins).toHaveBeenCalledWith(["codex"])
    expect(startBatch).toHaveBeenCalledWith(["codex"])
    nowSpy.mockRestore()
  })

  it("filters out ineligible plugins for refresh-all", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    const startBatch = vi.fn().mockResolvedValue(undefined)
    const setLoadingForPlugins = vi.fn()

    const { result } = renderHook(() =>
      useProbeRefreshActions({
        pluginSettings: { order: ["a", "b", "c"], disabled: [] },
        pluginStatesRef: {
          current: {
            a: { data: null, loading: true, error: null, lastManualRefreshAt: null, lastUpdatedAt: null },
            b: { data: null, loading: false, error: null, lastManualRefreshAt: 900_001, lastUpdatedAt: null },
            c: { data: null, loading: false, error: null, lastManualRefreshAt: null, lastUpdatedAt: null },
          },
        },
        manualRefreshIdsRef: { current: new Set<string>(["b"]) },
        resetAutoUpdateSchedule: vi.fn(),
        setLoadingForPlugins,
        setErrorForPlugins: vi.fn(),
        startBatch,
      })
    )

    act(() => {
      result.current.handleRefreshAll()
    })

    expect(setLoadingForPlugins).toHaveBeenCalledWith(["c"])
    expect(startBatch).toHaveBeenCalledWith(["c"])
    nowSpy.mockRestore()
  })

  it("returns early when settings are unavailable or no plugins are eligible", () => {
    const startBatch = vi.fn()
    const resetAutoUpdateSchedule = vi.fn()

    const { result, rerender } = renderHook(
      ({ settings }: { settings: { order: string[]; disabled: string[] } | null }) =>
        useProbeRefreshActions({
          pluginSettings: settings,
          pluginStatesRef: {
            current: {
              codex: { data: null, loading: true, error: null, lastManualRefreshAt: null, lastUpdatedAt: null },
            },
          },
          manualRefreshIdsRef: { current: new Set<string>() },
          resetAutoUpdateSchedule,
          setLoadingForPlugins: vi.fn(),
          setErrorForPlugins: vi.fn(),
          startBatch,
        }),
      { initialProps: { settings: null } }
    )

    act(() => {
      result.current.handleRefreshAll()
    })
    expect(startBatch).not.toHaveBeenCalled()

    getEnabledPluginIdsMock.mockReturnValueOnce([])
    rerender({ settings: { order: ["codex"], disabled: [] } })
    act(() => {
      result.current.handleRefreshAll()
    })
    expect(startBatch).not.toHaveBeenCalled()
    expect(resetAutoUpdateSchedule).not.toHaveBeenCalled()
  })

  it("cleans up manual refresh ids and sets errors when refresh-all batch start fails", async () => {
    const failure = new Error("batch failed")
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const manualRefreshIdsRef = { current: new Set<string>() }
    const setErrorForPlugins = vi.fn()

    const { result } = renderHook(() =>
      useProbeRefreshActions({
        pluginSettings: { order: ["codex"], disabled: [] },
        pluginStatesRef: { current: {} },
        manualRefreshIdsRef,
        resetAutoUpdateSchedule: vi.fn(),
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins,
        startBatch: vi.fn().mockRejectedValueOnce(failure),
      })
    )

    act(() => {
      result.current.handleRefreshAll()
    })

    await waitFor(() => {
      expect(setErrorForPlugins).toHaveBeenCalledWith(["codex"], "Failed to start probe")
      expect(errorSpy).toHaveBeenCalledWith("Failed to start refresh batch:", failure)
    })

    expect(manualRefreshIdsRef.current.has("codex")).toBe(false)
    errorSpy.mockRestore()
  })

  it("cleans up manual refresh ids and sets errors when batch start fails", async () => {
    const failure = new Error("batch failed")
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const manualRefreshIdsRef = { current: new Set<string>() }
    const setErrorForPlugins = vi.fn()

    const { result } = renderHook(() =>
      useProbeRefreshActions({
        pluginSettings: { order: ["codex"], disabled: [] },
        pluginStatesRef: { current: {} },
        manualRefreshIdsRef,
        resetAutoUpdateSchedule: vi.fn(),
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins,
        startBatch: vi.fn().mockRejectedValueOnce(failure),
      })
    )

    act(() => {
      result.current.handleRetryPlugin("codex")
    })

    await waitFor(() => {
      expect(setErrorForPlugins).toHaveBeenCalledWith(["codex"], "Failed to start probe")
      expect(errorSpy).toHaveBeenCalledWith("Failed to retry plugin:", failure)
    })

    expect(manualRefreshIdsRef.current.has("codex")).toBe(false)
    errorSpy.mockRestore()
  })
})
