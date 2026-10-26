import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  handleProbeResultMock,
  handleRefreshAllMock,
  handleRetryPluginMock,
  isPluginLoadingMock,
  resetAutoUpdateScheduleMock,
  setAutoUpdateNextAtMock,
  setErrorForPluginsMock,
  setLoadingForPluginsMock,
  startBatchMock,
  useProbeAutoUpdateMock,
  useProbeEventsMock,
  useProbeRefreshActionsMock,
  useProbeStateMock,
} = vi.hoisted(() => ({
  handleProbeResultMock: vi.fn(),
  handleRefreshAllMock: vi.fn(),
  handleRetryPluginMock: vi.fn(),
  isPluginLoadingMock: vi.fn(),
  resetAutoUpdateScheduleMock: vi.fn(),
  setAutoUpdateNextAtMock: vi.fn(),
  setErrorForPluginsMock: vi.fn(),
  setLoadingForPluginsMock: vi.fn(),
  startBatchMock: vi.fn(),
  useProbeAutoUpdateMock: vi.fn(),
  useProbeEventsMock: vi.fn(),
  useProbeRefreshActionsMock: vi.fn(),
  useProbeStateMock: vi.fn(),
}))

vi.mock("@/hooks/use-probe-events", () => ({
  useProbeEvents: useProbeEventsMock,
}))

vi.mock("@/hooks/app/use-probe-auto-update", () => ({
  useProbeAutoUpdate: useProbeAutoUpdateMock,
}))

vi.mock("@/hooks/app/use-probe-refresh-actions", () => ({
  useProbeRefreshActions: useProbeRefreshActionsMock,
}))

vi.mock("@/hooks/app/use-probe-state", () => ({
  useProbeState: useProbeStateMock,
}))

import { useProbe } from "@/hooks/app/use-probe"

describe("useProbe", () => {
  beforeEach(() => {
    const pluginStatesRef = { current: { codex: { loading: true } } }
    const manualRefreshIdsRef = { current: new Set<string>() }

    useProbeStateMock.mockReset()
    useProbeEventsMock.mockReset()
    useProbeAutoUpdateMock.mockReset()
    useProbeRefreshActionsMock.mockReset()
    handleProbeResultMock.mockReset()
    handleRefreshAllMock.mockReset()
    handleRetryPluginMock.mockReset()
    isPluginLoadingMock.mockReset()
    resetAutoUpdateScheduleMock.mockReset()
    setAutoUpdateNextAtMock.mockReset()
    setErrorForPluginsMock.mockReset()
    setLoadingForPluginsMock.mockReset()
    startBatchMock.mockReset()

    useProbeStateMock.mockImplementation(({ onProbeResult }: { onProbeResult?: () => void }) => {
      handleProbeResultMock.mockImplementation(() => {
        onProbeResult?.()
      })
      return {
        pluginStates: { codex: { loading: true } },
        pluginStatesRef,
        manualRefreshIdsRef,
        setLoadingForPlugins: setLoadingForPluginsMock,
        setErrorForPlugins: setErrorForPluginsMock,
        hydrateCachedUsage: vi.fn(),
        handleProbeResult: handleProbeResultMock,
      }
    })

    useProbeEventsMock.mockReturnValue({
      startBatch: startBatchMock,
    })

    useProbeAutoUpdateMock.mockReturnValue({
      autoUpdateNextAt: 123,
      setAutoUpdateNextAt: setAutoUpdateNextAtMock,
      resetAutoUpdateSchedule: resetAutoUpdateScheduleMock,
    })

    useProbeRefreshActionsMock.mockReturnValue({
      handleRetryPlugin: handleRetryPluginMock,
      handleRefreshAll: handleRefreshAllMock,
    })

    isPluginLoadingMock.mockImplementation(
      (id: string) => Boolean(pluginStatesRef.current[id as keyof typeof pluginStatesRef.current]?.loading)
    )
  })

  it("composes probe hooks and exposes their return values", () => {
    const onProbeResult = vi.fn()
    const pluginSettings = { order: ["codex"], disabled: [] }

    const { result } = renderHook(() =>
      useProbe({
        pluginSettings,
        autoUpdateInterval: 15,
        onProbeResult,
      })
    )

    expect(useProbeStateMock).toHaveBeenCalledWith({ onProbeResult })
    expect(useProbeEventsMock).toHaveBeenCalledWith({
      onResult: handleProbeResultMock,
      onBatchComplete: expect.any(Function),
    })
    expect(useProbeAutoUpdateMock).toHaveBeenCalledWith({
      pluginSettings,
      autoUpdateInterval: 15,
      panelVisible: true,
      isDataStale: expect.any(Function),
      setLoadingForPlugins: setLoadingForPluginsMock,
      setErrorForPlugins: setErrorForPluginsMock,
      isPluginLoading: expect.any(Function),
      startBatch: startBatchMock,
    })
    expect(useProbeRefreshActionsMock).toHaveBeenCalledWith({
      pluginSettings,
      pluginStatesRef: expect.any(Object),
      manualRefreshIdsRef: expect.any(Object),
      resetAutoUpdateSchedule: resetAutoUpdateScheduleMock,
      setLoadingForPlugins: setLoadingForPluginsMock,
      setErrorForPlugins: setErrorForPluginsMock,
      startBatch: startBatchMock,
    })

    expect(result.current).toEqual({
      pluginStates: { codex: { loading: true } },
      setLoadingForPlugins: setLoadingForPluginsMock,
      setErrorForPlugins: setErrorForPluginsMock,
      startBatch: startBatchMock,
      hydrateCachedUsage: expect.any(Function),
      autoUpdateNextAt: 123,
      setAutoUpdateNextAt: setAutoUpdateNextAtMock,
      handleRetryPlugin: handleRetryPluginMock,
      handleRefreshAll: handleRefreshAllMock,
    })
  })

  it("forwards probe results through the no-op batch complete handler", () => {
    const onProbeResult = vi.fn()

    renderHook(() =>
      useProbe({
        pluginSettings: { order: ["codex"], disabled: [] },
        autoUpdateInterval: 15,
        onProbeResult,
      })
    )

    const { onBatchComplete } = useProbeEventsMock.mock.calls[0][0]
    act(() => {
      onBatchComplete()
    })

    act(() => {
      handleProbeResultMock()
    })

    expect(onProbeResult).toHaveBeenCalledTimes(1)
  })

  it("reads loading state from pluginStatesRef via isPluginLoading", () => {
    renderHook(() =>
      useProbe({
        pluginSettings: { order: ["codex"], disabled: [] },
        autoUpdateInterval: 15,
      })
    )

    const { isPluginLoading } = useProbeAutoUpdateMock.mock.calls[0][0]
    expect(isPluginLoading("codex")).toBe(true)
    expect(isPluginLoading("missing")).toBe(false)
  })

  it("treats saved results as stale only after the normal interval", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000)

    renderHook(() =>
      useProbe({
        pluginSettings: null,
        autoUpdateInterval: 5,
      })
    )
    expect(useProbeAutoUpdateMock.mock.calls[0][0].isDataStale()).toBe(false)

    renderHook(() =>
      useProbe({
        pluginSettings: { order: ["codex", "claude"], disabled: [] },
        autoUpdateInterval: 5,
      })
    )
    const { isDataStale } = useProbeAutoUpdateMock.mock.calls[1][0]
    const { pluginStatesRef } = useProbeRefreshActionsMock.mock.calls[1][0]
    expect(isDataStale()).toBe(false)

    pluginStatesRef.current = {
      codex: { lastUpdatedAt: 1_000_000 - 60_000 },
      claude: { lastUpdatedAt: 1_000_000 - 60_000 },
    }
    expect(isDataStale()).toBe(false)

    pluginStatesRef.current = {
      codex: { lastUpdatedAt: 1_000_000 - 5 * 60_000 },
      claude: { lastUpdatedAt: null },
    }
    expect(isDataStale()).toBe(true)
    nowSpy.mockRestore()
  })
})
