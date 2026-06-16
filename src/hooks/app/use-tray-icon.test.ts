import { act, renderHook, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PluginMeta } from "@/lib/plugin-types"
import type { PluginSettings } from "@/lib/settings"

const settingsMocks = vi.hoisted(() => ({
  getEnabledPluginIds: null as ((settings: PluginSettings) => string[]) | null,
}))

const {
  getTrayIconSizePxMock,
  renderTrayBarsIconMock,
  resolveResourceMock,
  trayMock,
  trayGetByIdMock,
} = vi.hoisted(() => {
  const tray = {
    setIcon: vi.fn(async () => undefined),
    setIconAsTemplate: vi.fn(async () => undefined),
    setTitle: vi.fn(async () => undefined),
    setTooltip: vi.fn(async () => undefined),
  }

  return {
    trayMock: tray,
    trayGetByIdMock: vi.fn().mockResolvedValue(tray),
    resolveResourceMock: vi.fn().mockResolvedValue("/gauge.png"),
    getTrayIconSizePxMock: vi.fn(() => 22),
    renderTrayBarsIconMock: vi.fn().mockResolvedValue("rendered-icon"),
  }
})

vi.mock("@tauri-apps/api/tray", () => ({
  TrayIcon: {
    getById: trayGetByIdMock,
  },
}))

vi.mock("@tauri-apps/api/path", () => ({
  resolveResource: resolveResourceMock,
}))

vi.mock("@/lib/tray-bars-icon", () => ({
  getTrayIconSizePx: getTrayIconSizePxMock,
  renderTrayBarsIcon: renderTrayBarsIconMock,
}))

vi.mock("@/lib/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings")>()
  return {
    ...actual,
    getEnabledPluginIds: (settings: PluginSettings) =>
      settingsMocks.getEnabledPluginIds?.(settings) ?? actual.getEnabledPluginIds(settings),
  }
})

import { isSameTraySettingsPreview, useTrayIcon, type TraySettingsPreview } from "@/hooks/app/use-tray-icon"

const pluginsMeta: PluginMeta[] = [
  {
    id: "codex",
    name: "Codex",
    iconUrl: "/codex.svg",
    brandColor: "#111111",
    lines: [],
    primaryCandidates: ["Usage"],
    weeklyCandidate: "Weekly Usage",
  },
  {
    id: "cursor",
    name: "Cursor",
    iconUrl: "/cursor.svg",
    brandColor: "#222222",
    lines: [],
    primaryCandidates: ["Usage"],
    weeklyCandidate: "Weekly Usage",
  },
]

const pluginSettings: PluginSettings = {
  order: ["codex", "cursor"],
  disabled: [],
}

const pluginStates = {
  codex: {
    data: {
      providerId: "codex",
      displayName: "Codex",
      iconUrl: "/codex.svg",
      lines: [
        {
          type: "progress" as const,
          label: "Usage",
          used: 50,
          limit: 100,
          format: { kind: "percent" as const },
        },
        {
          type: "progress" as const,
          label: "Weekly Usage",
          used: 20,
          limit: 100,
          format: { kind: "percent" as const },
        },
      ],
    },
    loading: false,
    error: null,
    lastManualRefreshAt: null,
    lastUpdatedAt: 1_000,
  },
  cursor: {
    data: {
      providerId: "cursor",
      displayName: "Cursor",
      iconUrl: "/cursor.svg",
      lines: [
        {
          type: "progress" as const,
          label: "Usage",
          used: 25,
          limit: 100,
          format: { kind: "percent" as const },
        },
        {
          type: "progress" as const,
          label: "Weekly Usage",
          used: 10,
          limit: 100,
          format: { kind: "percent" as const },
        },
      ],
    },
    loading: false,
    error: null,
    lastManualRefreshAt: null,
    lastUpdatedAt: 1_000,
  },
}

const defaultHookProps = {
  pluginsMeta,
  pluginSettings,
  pluginStates,
  displayMode: "used" as const,
  menubarIconStyle: "watchtower" as const,
  menubarMetric: "default" as const,
  activeView: "home",
}

function renderTrayHook(overrides: Partial<Parameters<typeof useTrayIcon>[0]> = {}) {
  return renderHook((props: Parameters<typeof useTrayIcon>[0]) => useTrayIcon(props), {
    initialProps: {
      ...defaultHookProps,
      ...overrides,
    },
  })
}

async function waitForTrayReady() {
  await waitFor(() => {
    expect(trayGetByIdMock).toHaveBeenCalledWith("tray")
  })
}

describe("useTrayIcon", () => {
  beforeEach(() => {
    settingsMocks.getEnabledPluginIds = null

    trayGetByIdMock.mockReset()
    resolveResourceMock.mockReset()
    getTrayIconSizePxMock.mockReset()
    renderTrayBarsIconMock.mockReset()

    trayGetByIdMock.mockResolvedValue(trayMock)
    resolveResourceMock.mockResolvedValue("/gauge.png")
    getTrayIconSizePxMock.mockReturnValue(22)
    renderTrayBarsIconMock.mockResolvedValue("rendered-icon")

    trayMock.setIcon.mockReset()
    trayMock.setIcon.mockResolvedValue(undefined)
    trayMock.setIconAsTemplate.mockReset()
    trayMock.setIconAsTemplate.mockResolvedValue(undefined)
    trayMock.setTitle.mockReset()
    trayMock.setTitle.mockResolvedValue(undefined)
    trayMock.setTooltip.mockReset()
    trayMock.setTooltip.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("initializes the tray handle and schedules an update", async () => {
    const { result } = renderTrayHook()

    await waitForTrayReady()
    await waitFor(() => {
      expect(resolveResourceMock).toHaveBeenCalledWith("icons/tray-icon.png")
      expect(trayMock.setIcon).toHaveBeenCalledWith("/gauge.png")
    })

    expect(result.current.traySettingsPreview.bars.length).toBeGreaterThan(0)
  })

  it("restores the gauge icon when plugin settings are missing", async () => {
    const { result } = renderTrayHook({ pluginSettings: null })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview).toEqual({
        bars: [],
        providerBars: [],
        providerPercentText: "--%",
      })
      expect(trayMock.setIcon).toHaveBeenCalledWith("/gauge.png")
    })
  })

  it("finalizes tray restore when the gauge asset is unavailable", async () => {
    resolveResourceMock.mockRejectedValueOnce(new Error("missing gauge"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    const { result } = renderTrayHook({ pluginSettings: null })

    await waitForTrayReady()

    trayMock.setIcon.mockClear()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview).toEqual({
        bars: [],
        providerBars: [],
        providerPercentText: "--%",
      })
    })

    expect(trayMock.setIcon).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("restores the gauge icon when no providers are enabled", async () => {
    const { result } = renderTrayHook({
      pluginSettings: { order: ["codex", "cursor"], disabled: ["codex", "cursor"] },
    })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.bars).toEqual([])
      expect(trayMock.setIcon).toHaveBeenCalledWith("/gauge.png")
    })
  })

  it("updates tray bars style icons", async () => {
    const { result } = renderTrayHook({ menubarIconStyle: "bars" })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(renderTrayBarsIconMock).toHaveBeenCalledWith(
        expect.objectContaining({ style: "bars", sizePx: 22 })
      )
    })

    expect(trayMock.setIcon).toHaveBeenCalledWith("rendered-icon")
  })

  it("updates donut style icons for the active provider", async () => {
    const { result } = renderTrayHook({
      menubarIconStyle: "donut",
      activeView: "cursor",
    })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(renderTrayBarsIconMock).toHaveBeenCalledWith(
        expect.objectContaining({
          style: "donut",
          providerIconUrl: "/cursor.svg",
        })
      )
    })

    expect(trayMock.setIcon).toHaveBeenCalledWith("rendered-icon")
  })

  it("updates provider style icons and sets the native title", async () => {
    const { result } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(renderTrayBarsIconMock).toHaveBeenCalledWith(
        expect.objectContaining({
          style: "provider",
          providerIconUrl: "/codex.svg",
        })
      )
    })

    expect(trayMock.setTitle).toHaveBeenCalled()
    expect(trayMock.setIcon).toHaveBeenCalledWith("rendered-icon")
  })

  it("queues a follow-up update while another update is pending", async () => {
    const { result } = renderTrayHook({ menubarIconStyle: "bars" })

    await waitForTrayReady()

    renderTrayBarsIconMock.mockClear()
    vi.useFakeTimers()

    let resolveIcon!: (value: string) => void
    renderTrayBarsIconMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveIcon = resolve
        })
    )

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
      vi.runOnlyPendingTimers()
    })

    expect(renderTrayBarsIconMock).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.scheduleTrayIconUpdate("probe", 0)
      vi.runOnlyPendingTimers()
    })

    expect(renderTrayBarsIconMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveIcon("rendered-icon")
      await Promise.resolve()
    })

    act(() => {
      vi.runOnlyPendingTimers()
    })

    expect(renderTrayBarsIconMock).toHaveBeenCalledTimes(2)
  })

  it("finalizes immediately when scheduled before the tray handle exists", async () => {
    let resolveTray!: (tray: typeof trayMock) => void
    trayGetByIdMock.mockImplementation(
      () =>
        new Promise<typeof trayMock>((resolve) => {
          resolveTray = resolve
        })
    )

    const { result } = renderTrayHook({ menubarIconStyle: "bars" })

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(renderTrayBarsIconMock).not.toHaveBeenCalled()

    await act(async () => {
      resolveTray(trayMock)
    })

    await waitForTrayReady()
  })

  it("handles trays without native title or tooltip support", async () => {
    const trayWithoutNativeSupport = {
      setIcon: vi.fn(async () => undefined),
      setIconAsTemplate: vi.fn(async () => undefined),
    }
    trayGetByIdMock.mockResolvedValue(trayWithoutNativeSupport)

    const { result } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(renderTrayBarsIconMock).toHaveBeenCalledWith(
        expect.objectContaining({
          style: "provider",
          percentText: "50%",
        })
      )
    })

    expect(trayWithoutNativeSupport.setIcon).toHaveBeenCalledWith("rendered-icon")
  })

  it("logs restore gauge icon failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    trayMock.setIcon.mockRejectedValueOnce(new Error("restore failed"))

    const { result } = renderTrayHook({ pluginSettings: null })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to restore tray gauge icon:",
        expect.any(Error)
      )
    })

    consoleError.mockRestore()
  })

  it("finalizes restore when the gauge path is unavailable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    resolveResourceMock.mockRejectedValueOnce(new Error("missing gauge"))

    const { result } = renderTrayHook({ pluginSettings: null })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.bars).toEqual([])
    })

    expect(trayMock.setIcon).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("reuses the last tray provider when returning to home", async () => {
    const { result, rerender } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "cursor",
    })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerIconUrl).toBe("/cursor.svg")
    })

    rerender({
      ...defaultHookProps,
      menubarIconStyle: "provider",
      activeView: "home",
    })

    await waitFor(() => {
      expect(renderTrayBarsIconMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          style: "provider",
          providerIconUrl: "/cursor.svg",
        })
      )
    })
  })

  it("updates watchtower tooltip when the gauge path is unavailable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    resolveResourceMock.mockRejectedValueOnce(new Error("missing gauge"))

    const { result } = renderTrayHook({ menubarIconStyle: "watchtower" })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(trayMock.setTooltip).toHaveBeenCalled()
    })

    expect(trayMock.setIcon).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("logs watchtower tooltip failures when the gauge path is unavailable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    resolveResourceMock.mockRejectedValueOnce(new Error("missing gauge"))
    trayMock.setTooltip.mockRejectedValueOnce(new Error("tooltip failed"))

    const { result } = renderTrayHook({ menubarIconStyle: "watchtower" })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Failed to update tray tooltip:", expect.any(Error))
    })

    consoleError.mockRestore()
  })

  it("logs watchtower icon update failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    trayMock.setIcon.mockRejectedValueOnce(new Error("watchtower failed"))

    const { result } = renderTrayHook({ menubarIconStyle: "watchtower" })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to update tray watchtower icon:",
        expect.any(Error)
      )
    })

    consoleError.mockRestore()
  })

  it("logs bars icon update failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    renderTrayBarsIconMock.mockRejectedValueOnce(new Error("bars failed"))

    const { result } = renderTrayHook({ menubarIconStyle: "bars" })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Failed to update tray icon:", expect.any(Error))
    })

    consoleError.mockRestore()
  })

  it("logs donut icon update failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    renderTrayBarsIconMock.mockRejectedValueOnce(new Error("donut failed"))

    const { result } = renderTrayHook({
      menubarIconStyle: "donut",
      activeView: "cursor",
    })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Failed to update tray icon:", expect.any(Error))
    })

    consoleError.mockRestore()
  })

  it("logs provider icon update failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    renderTrayBarsIconMock.mockRejectedValueOnce(new Error("provider failed"))

    const { result } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Failed to update tray icon:", expect.any(Error))
    })

    consoleError.mockRestore()
  })

  it("prefers weekly metrics when menubar metric is weekly", async () => {
    const { result } = renderTrayHook({
      menubarIconStyle: "provider",
      menubarMetric: "weekly",
      activeView: "codex",
    })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerPercentText).toBe("20%")
      expect(result.current.traySettingsPreview.bars.some((bar) => bar.weekly)).toBe(true)
    })
  })

  it("restores the gauge icon when no tray provider id can be resolved", async () => {
    settingsMocks.getEnabledPluginIds = () => [undefined as unknown as string]

    const { result } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(trayMock.setIcon).toHaveBeenCalledWith("/gauge.png")
    })
  })

  it("skips preview state updates when tray settings are unchanged", async () => {
    const { result } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerIconUrl).toBe("/codex.svg")
    })

    const previewRef = result.current.traySettingsPreview

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(trayMock.setIcon).toHaveBeenCalled()
    })

    expect(result.current.traySettingsPreview).toBe(previewRef)
  })

  it("updates preview when provider icon url changes", async () => {
    const { result, rerender } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerIconUrl).toBe("/codex.svg")
    })

    rerender({
      ...defaultHookProps,
      menubarIconStyle: "provider",
      activeView: "cursor",
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerIconUrl).toBe("/cursor.svg")
    })
  })

  it("updates preview when provider percent text changes", async () => {
    const { result, rerender } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerPercentText).toBe("50%")
    })

    rerender({
      ...defaultHookProps,
      menubarIconStyle: "provider",
      activeView: "codex",
      pluginStates: {
        ...pluginStates,
        codex: {
          ...pluginStates.codex,
          data: {
            ...pluginStates.codex.data!,
            lines: [
              {
                type: "progress" as const,
                label: "Usage",
                used: 80,
                limit: 100,
                format: { kind: "percent" as const },
              },
            ],
          },
        },
      },
    })

    act(() => {
      result.current.scheduleTrayIconUpdate("probe", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerPercentText).toBe("80%")
    })
  })

  it("updates preview when bar ids change", async () => {
    const { result, rerender } = renderTrayHook({
      menubarIconStyle: "bars",
      activeView: "codex",
    })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.bars.map((bar) => bar.id)).toEqual(["codex", "cursor"])
    })

    rerender({
      ...defaultHookProps,
      menubarIconStyle: "bars",
      activeView: "codex",
      pluginSettings: {
        order: ["cursor", "codex"],
        disabled: [],
      },
    })

    act(() => {
      result.current.scheduleTrayIconUpdate("probe", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.bars.map((bar) => bar.id)).toEqual(["cursor", "codex"])
    })
  })

  it("updates preview when bar fractions change", async () => {
    const { result, rerender } = renderTrayHook({
      menubarIconStyle: "bars",
      activeView: "codex",
    })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.bars[1]?.fraction).toBeCloseTo(0.25)
    })

    rerender({
      ...defaultHookProps,
      menubarIconStyle: "bars",
      activeView: "codex",
      pluginStates: {
        ...pluginStates,
        cursor: {
          ...pluginStates.cursor,
          data: {
            ...pluginStates.cursor.data!,
            lines: [
              {
                type: "progress" as const,
                label: "Usage",
                used: 90,
                limit: 100,
                format: { kind: "percent" as const },
              },
              {
                type: "progress" as const,
                label: "Weekly Usage",
                used: 10,
                limit: 100,
                format: { kind: "percent" as const },
              },
            ],
          },
        },
      },
    })

    act(() => {
      result.current.scheduleTrayIconUpdate("probe", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.bars[1]?.fraction).toBeCloseTo(0.9)
    })
  })

  it("updates preview when bar count changes", async () => {
    const { result, rerender } = renderTrayHook({ menubarIconStyle: "bars" })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.bars).toHaveLength(2)
    })

    rerender({
      ...defaultHookProps,
      menubarIconStyle: "bars",
      pluginSettings: {
        order: ["codex", "cursor"],
        disabled: ["cursor"],
      },
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.bars).toHaveLength(1)
    })
  })

  it("updates preview when provider bar details change", async () => {
    const { result, rerender } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerBars[0]?.fraction).toBeCloseTo(0.5)
    })

    rerender({
      ...defaultHookProps,
      menubarIconStyle: "provider",
      activeView: "codex",
      pluginStates: {
        ...pluginStates,
        codex: {
          ...pluginStates.codex,
          data: {
            ...pluginStates.codex.data!,
            lines: [
              {
                type: "progress" as const,
                label: "Usage",
                used: 70,
                limit: 100,
                format: { kind: "percent" as const },
              },
            ],
          },
        },
      },
    })

    act(() => {
      result.current.scheduleTrayIconUpdate("probe", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerBars[0]?.id).toBe("codex")
      expect(result.current.traySettingsPreview.providerBars[0]?.fraction).toBeCloseTo(0.7)
    })
  })

  it("updates preview when provider bars populate after a provider-less preview", async () => {
    settingsMocks.getEnabledPluginIds = () => [undefined as unknown as string]

    const { result } = renderTrayHook({ menubarIconStyle: "bars" })

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.bars.length).toBeGreaterThan(0)
      expect(result.current.traySettingsPreview.providerBars).toEqual([])
    })

    settingsMocks.getEnabledPluginIds = null

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerBars).toHaveLength(1)
    })
  })

  it("skips init scheduling when provider metadata is unavailable", async () => {
    const { rerender } = renderTrayHook()

    await waitForTrayReady()

    rerender({
      ...defaultHookProps,
      pluginsMeta: [],
    })
  })

  it("skips tray init when the hook unmounts before the tray handle resolves", async () => {
    let resolveTray!: (tray: typeof trayMock) => void
    trayGetByIdMock.mockImplementation(
      () =>
        new Promise<typeof trayMock>((resolve) => {
          resolveTray = resolve
        })
    )

    const { unmount } = renderTrayHook()
    unmount()

    await act(async () => {
      resolveTray(trayMock)
      await Promise.resolve()
    })

    expect(resolveResourceMock).not.toHaveBeenCalled()
  })

  it("skips tray init when the hook unmounts before the gauge path resolves", async () => {
    let resolveGauge!: (path: string) => void
    resolveResourceMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveGauge = resolve
        })
    )

    const { unmount } = renderTrayHook()
    await waitFor(() => {
      expect(trayGetByIdMock).toHaveBeenCalled()
    })

    unmount()

    await act(async () => {
      resolveGauge("/gauge.png")
      await Promise.resolve()
    })

    expect(resolveResourceMock).toHaveBeenCalledWith("icons/tray-icon.png")
  })

  it("skips init scheduling when plugin settings are unavailable", async () => {
    const { result, rerender } = renderTrayHook()

    await waitForTrayReady()

    rerender({
      ...defaultHookProps,
      pluginSettings: null,
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview).toEqual({
        bars: [],
        providerBars: [],
        providerPercentText: "--%",
      })
    })
  })

  it("initializes once under strict mode after the tray handle resolves", async () => {
    const { unmount } = renderHook((props: Parameters<typeof useTrayIcon>[0]) => useTrayIcon(props), {
      wrapper: StrictMode,
      initialProps: defaultHookProps,
    })

    await waitForTrayReady()
    expect(trayGetByIdMock.mock.calls.length).toBeGreaterThanOrEqual(1)

    trayGetByIdMock.mockClear()
    unmount()

    renderHook((props: Parameters<typeof useTrayIcon>[0]) => useTrayIcon(props), {
      initialProps: defaultHookProps,
    })

    await waitForTrayReady()
    expect(trayGetByIdMock).toHaveBeenCalledTimes(1)
  })

  it("updates preview when a provider bar loses its fraction", async () => {
    const { result, rerender } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerBars[0]?.fraction).toBeCloseTo(0.5)
    })

    rerender({
      ...defaultHookProps,
      menubarIconStyle: "provider",
      activeView: "codex",
      pluginStates: {
        ...pluginStates,
        codex: {
          ...pluginStates.codex,
          data: {
            ...pluginStates.codex.data!,
            lines: [],
          },
        },
      },
    })

    act(() => {
      result.current.scheduleTrayIconUpdate("probe", 0)
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerBars[0]?.fraction).toBeUndefined()
      expect(result.current.traySettingsPreview.providerPercentText).toBe("--%")
    })
  })

  it("updates preview when the active provider changes", async () => {
    const { result, rerender } = renderTrayHook({
      menubarIconStyle: "provider",
      activeView: "codex",
    })

    await waitForTrayReady()
    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerBars[0]?.id).toBe("codex")
    })

    rerender({
      ...defaultHookProps,
      menubarIconStyle: "provider",
      activeView: "cursor",
    })

    await waitFor(() => {
      expect(result.current.traySettingsPreview.providerBars[0]?.id).toBe("cursor")
      expect(result.current.traySettingsPreview.providerBars[0]?.fraction).toBeCloseTo(0.25)
    })
  })

  it("logs tray initialization failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    trayGetByIdMock.mockRejectedValueOnce(new Error("missing tray"))

    renderTrayHook()

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Failed to load tray icon handle:", expect.any(Error))
    })

    consoleError.mockRestore()
  })

  it("logs resolve resource failures without blocking tray readiness", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    resolveResourceMock.mockRejectedValueOnce(new Error("missing gauge"))

    renderTrayHook()

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to resolve tray gauge icon resource:",
        expect.any(Error)
      )
    })

    consoleError.mockRestore()
  })

  it("clears pending timers on unmount", async () => {
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
    const { result, unmount } = renderTrayHook()

    await waitForTrayReady()

    act(() => {
      result.current.scheduleTrayIconUpdate("settings", 100)
    })

    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})

describe("isSameTraySettingsPreview", () => {
  it("returns false when provider bar counts differ", () => {
    const shared = {
      bars: [
        { id: "codex", fraction: 0.5 },
        { id: "cursor", fraction: 0.25 },
      ],
      providerPercentText: "--%",
    } satisfies Omit<TraySettingsPreview, "providerBars">

    expect(
      isSameTraySettingsPreview(
        { ...shared, providerBars: [] },
        { ...shared, providerBars: [{ id: "codex", fraction: 0.5 }] }
      )
    ).toBe(false)
  })

  it("returns false when provider bar ids differ", () => {
    const shared = {
      bars: [{ id: "codex", fraction: 0.5 }],
      providerIconUrl: "/codex.svg",
      providerPercentText: "50%",
    } satisfies Omit<TraySettingsPreview, "providerBars">

    expect(
      isSameTraySettingsPreview(
        { ...shared, providerBars: [{ id: "codex", fraction: 0.5 }] },
        { ...shared, providerBars: [{ id: "cursor", fraction: 0.5 }] }
      )
    ).toBe(false)
  })

  it("returns false when provider bar fractions differ", () => {
    const shared = {
      bars: [{ id: "codex", fraction: 0.5 }],
      providerIconUrl: "/codex.svg",
      providerPercentText: "50%",
    } satisfies Omit<TraySettingsPreview, "providerBars">

    expect(
      isSameTraySettingsPreview(
        { ...shared, providerBars: [{ id: "codex", fraction: 0.5 }] },
        { ...shared, providerBars: [{ id: "codex", fraction: 0.8 }] }
      )
    ).toBe(false)
  })
})
