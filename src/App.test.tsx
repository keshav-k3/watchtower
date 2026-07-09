import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  appShellProps: null as any,
  capturedOnProbeResult: null as (() => void) | null,
  handleRefreshAllMock: vi.fn(),
  handleRetryPluginMock: vi.fn(),
  scheduleTrayIconUpdateMock: vi.fn(),
  startBatchMock: vi.fn(async () => ["alpha", "beta"]),
  setLoadingForPluginsMock: vi.fn(),
  setErrorForPluginsMock: vi.fn(),
  applyStartOnLoginMock: vi.fn(),
  savePluginSettingsMock: vi.fn(async () => undefined),
  saveThemeModeMock: vi.fn(async () => undefined),
  pluginStates: {} as Record<string, any>,
}))

vi.mock("@/components/app/app-shell", () => ({
  AppShell: (props: any) => {
    state.appShellProps = props
    return (
      <div data-testid="app-shell">
        <button type="button" onClick={props.onRefreshAll}>
          Refresh All
        </button>
        <button type="button" onClick={() => props.appContentProps.onRetryPlugin("alpha")}>
          Retry Alpha
        </button>
        {props.navPlugins.map((plugin: { id: string; name: string }) => (
          <div key={plugin.id}>{plugin.name}</div>
        ))}
      </div>
    )
  },
}))

vi.mock("@/hooks/app/use-settings-bootstrap", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return {
    useSettingsBootstrap: (args: any) => {
      React.useEffect(() => {
        const pluginsMeta = [
          {
            id: "alpha",
            name: "Alpha",
            iconUrl: "/alpha.svg",
            brandColor: "#111111",
            lines: [],
            primaryCandidates: [],
          },
          {
            id: "beta",
            name: "Beta",
            iconUrl: "/beta.svg",
            brandColor: "#222222",
            lines: [],
            primaryCandidates: [],
          },
        ]

        args.setPluginsMeta(pluginsMeta)
        args.setPluginSettings({ order: ["alpha", "beta"], disabled: ["beta"] })
        args.setAutoUpdateInterval(5)
        args.setThemeMode("dark")
        args.setDisplayMode("left")
        args.setResetTimerDisplayMode("relative")
        args.setTimeFormatMode("auto")
        args.setGlobalShortcut("CommandOrControl+W")
        args.setStartOnLogin(true)
        args.setMenubarIconStyle("watchtower")
        args.setMenubarMetric("default")
        args.setLoadingForPlugins(["alpha", "beta"])
        void args.startBatch(["alpha", "beta"])
      }, [])

      return { applyStartOnLogin: state.applyStartOnLoginMock }
    },
  }
})

vi.mock("@/hooks/app/use-probe", () => ({
  useProbe: (args: { onProbeResult?: () => void }) => {
    state.capturedOnProbeResult = args.onProbeResult ?? null
    return {
      pluginStates: state.pluginStates,
      setLoadingForPlugins: state.setLoadingForPluginsMock,
      setErrorForPlugins: state.setErrorForPluginsMock,
      startBatch: state.startBatchMock,
      autoUpdateNextAt: null,
      handleRetryPlugin: state.handleRetryPluginMock,
      handleRefreshAll: state.handleRefreshAllMock,
    }
  },
}))

vi.mock("@/hooks/app/use-tray-icon", () => ({
  useTrayIcon: () => ({
    scheduleTrayIconUpdate: state.scheduleTrayIconUpdateMock,
    traySettingsPreview: {
      bars: [],
      providerBars: [],
      providerPercentText: "--%",
    },
  }),
}))

vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings")
  return {
    ...actual,
    savePluginSettings: state.savePluginSettingsMock,
    saveThemeMode: state.saveThemeModeMock,
  }
})

import { App } from "@/App"
import { useAppPluginStore } from "@/stores/app-plugin-store"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import { useAppUiStore } from "@/stores/app-ui-store"

describe("App", () => {
  beforeEach(() => {
    state.appShellProps = null
    state.capturedOnProbeResult = null
    state.handleRefreshAllMock.mockReset()
    state.handleRetryPluginMock.mockReset()
    state.scheduleTrayIconUpdateMock.mockReset()
    state.startBatchMock.mockClear()
    state.setLoadingForPluginsMock.mockReset()
    state.setErrorForPluginsMock.mockReset()
    state.savePluginSettingsMock.mockReset()
    state.savePluginSettingsMock.mockResolvedValue(undefined)
    state.saveThemeModeMock.mockReset()
    state.saveThemeModeMock.mockResolvedValue(undefined)
    state.pluginStates = {}
    useAppPluginStore.getState().resetState()
    useAppPreferencesStore.getState().resetState()
    useAppUiStore.getState().resetState()
    document.documentElement.className = ""
  })

  afterEach(() => {
    document.documentElement.className = ""
  })

  it("shows visible providers and omits removed Settings surfaces", async () => {
    render(<App />)

    await screen.findByText("Alpha")
    expect(screen.queryByText("Beta")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Help" })).not.toBeInTheDocument()

    expect(state.appShellProps.navPlugins.map((plugin: { id: string }) => plugin.id)).toEqual([
      "alpha",
    ])
    expect(state.appShellProps.settingsPlugins).toBeUndefined()
    expect(state.appShellProps.appContentProps.onToggle).toBeUndefined()
    expect(typeof state.appShellProps.onProviderToggle).toBe("function")
  })

  it("applies the fixed dark defaults during bootstrap", async () => {
    render(<App />)

    await waitFor(() => {
      expect(useAppPreferencesStore.getState()).toMatchObject({
        autoUpdateInterval: 5,
        themeMode: "dark",
        displayMode: "left",
        resetTimerDisplayMode: "relative",
        timeFormatMode: "auto",
        globalShortcut: "CommandOrControl+W",
        startOnLogin: true,
        menubarIconStyle: "watchtower",
        menubarMetric: "default",
      })
    })
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(state.setLoadingForPluginsMock).toHaveBeenCalledWith(["alpha", "beta"])
    expect(state.startBatchMock).toHaveBeenCalledWith(["alpha", "beta"])
  })

  it("persists theme mode changes from the shell", async () => {
    render(<App />)

    await screen.findByText("Alpha")
    await act(async () => {
      state.appShellProps.onThemeModeChange("light")
    })

    expect(useAppPreferencesStore.getState().themeMode).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(state.saveThemeModeMock).toHaveBeenCalledWith("light")
  })

  it("wires refresh and provider retry through the shell", async () => {
    render(<App />)

    await screen.findByText("Alpha")
    await userEvent.click(screen.getByRole("button", { name: "Refresh All" }))
    await userEvent.click(screen.getByRole("button", { name: "Retry Alpha" }))

    expect(state.handleRefreshAllMock).toHaveBeenCalledTimes(1)
    expect(state.handleRetryPluginMock).toHaveBeenCalledWith("alpha")
  })

  it("reloads a provider from the shell context action", async () => {
    render(<App />)

    await screen.findByText("Alpha")
    act(() => {
      state.appShellProps.onPluginContextAction("alpha", "reload")
    })

    expect(state.handleRetryPluginMock).toHaveBeenCalledWith("alpha")
  })

  it("ignores non-reload plugin context actions", async () => {
    render(<App />)

    await screen.findByText("Alpha")
    act(() => {
      state.appShellProps.onPluginContextAction("alpha", "remove")
    })

    expect(state.handleRetryPluginMock).not.toHaveBeenCalled()
  })

  it("reports refresh availability based on cooldown and loading state", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    const { rerender } = render(<App />)

    await screen.findByText("Alpha")

    expect(state.appShellProps.isPluginRefreshAvailable("missing")).toBe(true)

    state.pluginStates = {
      alpha: {
        data: null,
        loading: false,
        error: null,
        lastManualRefreshAt: null,
        lastUpdatedAt: null,
      },
    }
    rerender(<App />)
    expect(state.appShellProps.isPluginRefreshAvailable("alpha")).toBe(true)

    state.pluginStates = {
      alpha: {
        data: null,
        loading: true,
        error: null,
        lastManualRefreshAt: null,
        lastUpdatedAt: null,
      },
    }
    rerender(<App />)
    expect(state.appShellProps.isPluginRefreshAvailable("alpha")).toBe(false)

    state.pluginStates = {
      alpha: {
        data: null,
        loading: false,
        error: null,
        lastManualRefreshAt: 900_001,
        lastUpdatedAt: null,
      },
    }
    rerender(<App />)
    expect(state.appShellProps.isPluginRefreshAvailable("alpha")).toBe(false)

    state.pluginStates = {
      alpha: {
        data: null,
        loading: false,
        error: null,
        lastManualRefreshAt: 100_000,
        lastUpdatedAt: null,
      },
    }
    rerender(<App />)
    expect(state.appShellProps.isPluginRefreshAvailable("alpha")).toBe(true)

    nowSpy.mockRestore()
  })

  it("no-ops provider toggle when settings are not loaded", async () => {
    const { rerender } = render(<App />)

    await screen.findByText("Alpha")
    useAppPluginStore.getState().setPluginSettings(null)
    state.savePluginSettingsMock.mockClear()
    rerender(<App />)

    act(() => {
      state.appShellProps.onProviderToggle("alpha")
    })

    expect(state.savePluginSettingsMock).not.toHaveBeenCalled()
  })

  it("exposes no-op nav reorder and reset timer toggle handlers", async () => {
    render(<App />)

    await screen.findByText("Alpha")

    act(() => {
      state.appShellProps.onNavReorder()
      state.appShellProps.appContentProps.onResetTimerDisplayModeToggle()
    })
  })

  it("toggles provider visibility and refreshes re-enabled providers", async () => {
    render(<App />)

    await screen.findByText("Alpha")

    act(() => {
      state.appShellProps.onProviderToggle("beta")
    })

    await waitFor(() => {
      expect(useAppPluginStore.getState().pluginSettings?.disabled).toEqual([])
    })
    expect(state.setLoadingForPluginsMock).toHaveBeenCalledWith(["beta"])
    expect(state.startBatchMock).toHaveBeenCalledWith(["beta"])
    expect(state.scheduleTrayIconUpdateMock).toHaveBeenCalledWith("settings", 0)
    expect(state.savePluginSettingsMock).toHaveBeenCalled()
  })

  it("returns home when disabling the active provider", async () => {
    useAppUiStore.getState().setActiveView("alpha")
    render(<App />)

    await screen.findByText("Alpha")

    act(() => {
      state.appShellProps.onProviderToggle("alpha")
    })

    expect(useAppUiStore.getState().activeView).toBe("home")
  })

  it("debounces tray icon updates after probe results", async () => {
    render(<App />)

    await screen.findByText("Alpha")

    act(() => {
      state.capturedOnProbeResult?.()
    })

    expect(state.scheduleTrayIconUpdateMock).toHaveBeenCalledWith("probe", 500)
  })

  it("logs errors when re-enabling a provider fails to refresh", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    render(<App />)
    await screen.findByText("Alpha")

    state.startBatchMock.mockRejectedValueOnce(new Error("batch failed"))

    act(() => {
      state.appShellProps.onProviderToggle("beta")
    })

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to refresh visible provider:",
        expect.any(Error)
      )
    })

    consoleSpy.mockRestore()
  })

  it("logs errors when saving provider visibility fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    state.savePluginSettingsMock.mockRejectedValueOnce(new Error("save failed"))

    render(<App />)
    await screen.findByText("Alpha")

    act(() => {
      state.appShellProps.onProviderToggle("alpha")
    })

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save provider visibility:",
        expect.any(Error)
      )
    })

    consoleSpy.mockRestore()
  })
})
