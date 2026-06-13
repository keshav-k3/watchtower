import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  appShellProps: null as any,
  handleRefreshAllMock: vi.fn(),
  handleRetryPluginMock: vi.fn(),
  scheduleTrayIconUpdateMock: vi.fn(),
  startBatchMock: vi.fn(async () => ["alpha", "beta"]),
  setLoadingForPluginsMock: vi.fn(),
  setErrorForPluginsMock: vi.fn(),
  applyStartOnLoginMock: vi.fn(),
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
  useProbe: () => ({
    pluginStates: {},
    setLoadingForPlugins: state.setLoadingForPluginsMock,
    setErrorForPlugins: state.setErrorForPluginsMock,
    startBatch: state.startBatchMock,
    autoUpdateNextAt: null,
    handleRetryPlugin: state.handleRetryPluginMock,
    handleRefreshAll: state.handleRefreshAllMock,
  }),
}))

vi.mock("@/hooks/app/use-tray-icon", () => ({
  useTrayIcon: () => ({
    scheduleTrayIconUpdate: state.scheduleTrayIconUpdateMock,
    traySettingsPreview: {
      pluginId: null,
      style: "watchtower",
      metric: "default",
      bars: [],
      tooltip: null,
    },
  }),
}))

import { App } from "@/App"
import { useAppPluginStore } from "@/stores/app-plugin-store"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import { useAppUiStore } from "@/stores/app-ui-store"

describe("App", () => {
  beforeEach(() => {
    state.appShellProps = null
    state.handleRefreshAllMock.mockReset()
    state.handleRetryPluginMock.mockReset()
    state.scheduleTrayIconUpdateMock.mockReset()
    state.startBatchMock.mockClear()
    state.setLoadingForPluginsMock.mockReset()
    state.setErrorForPluginsMock.mockReset()
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

  it("wires refresh and provider retry through the shell", async () => {
    render(<App />)

    await screen.findByText("Alpha")
    await userEvent.click(screen.getByRole("button", { name: "Refresh All" }))
    await userEvent.click(screen.getByRole("button", { name: "Retry Alpha" }))

    expect(state.handleRefreshAllMock).toHaveBeenCalledTimes(1)
    expect(state.handleRetryPluginMock).toHaveBeenCalledWith("alpha")
  })
})
