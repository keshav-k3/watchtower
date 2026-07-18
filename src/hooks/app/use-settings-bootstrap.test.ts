import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  arePluginSettingsEqualMock,
  disableAutostartMock,
  enableAutostartMock,
  getEnabledPluginIdsMock,
  invokeMock,
  isAutostartEnabledMock,
  isTauriMock,
  loadAutoUpdateIntervalMock,
  loadDisplayModeMock,
  loadGlobalShortcutMock,
  loadMenubarIconStyleMock,
  loadMenubarMetricMock,
  loadPluginSettingsMock,
  loadResetTimerDisplayModeMock,
  loadStartOnLoginMock,
  loadThemeModeMock,
  loadTimeFormatModeMock,
  migrateLegacyTraySettingsMock,
  migrateRenamedPluginIdsMock,
  normalizePluginSettingsMock,
  savePluginSettingsMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
  isAutostartEnabledMock: vi.fn(),
  enableAutostartMock: vi.fn(),
  disableAutostartMock: vi.fn(),
  arePluginSettingsEqualMock: vi.fn(),
  getEnabledPluginIdsMock: vi.fn(),
  loadAutoUpdateIntervalMock: vi.fn(),
  loadDisplayModeMock: vi.fn(),
  loadGlobalShortcutMock: vi.fn(),
  loadMenubarIconStyleMock: vi.fn(),
  loadMenubarMetricMock: vi.fn(),
  loadPluginSettingsMock: vi.fn(),
  loadResetTimerDisplayModeMock: vi.fn(),
  loadStartOnLoginMock: vi.fn(),
  loadThemeModeMock: vi.fn(),
  loadTimeFormatModeMock: vi.fn(),
  migrateLegacyTraySettingsMock: vi.fn(),
  migrateRenamedPluginIdsMock: vi.fn(),
  normalizePluginSettingsMock: vi.fn(),
  savePluginSettingsMock: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}))

vi.mock("@tauri-apps/plugin-autostart", () => ({
  disable: disableAutostartMock,
  enable: enableAutostartMock,
  isEnabled: isAutostartEnabledMock,
}))

vi.mock("@/lib/settings", () => ({
  arePluginSettingsEqual: arePluginSettingsEqualMock,
  DEFAULT_AUTO_UPDATE_INTERVAL: 5,
  DEFAULT_DISPLAY_MODE: "left",
  DEFAULT_GLOBAL_SHORTCUT: "CommandOrControl+W",
  DEFAULT_MENUBAR_ICON_STYLE: "watchtower",
  DEFAULT_MENUBAR_METRIC: "default",
  DEFAULT_RESET_TIMER_DISPLAY_MODE: "relative",
  DEFAULT_START_ON_LOGIN: true,
  DEFAULT_TIME_FORMAT_MODE: "auto",
  getEnabledPluginIds: getEnabledPluginIdsMock,
  loadAutoUpdateInterval: loadAutoUpdateIntervalMock,
  loadDisplayMode: loadDisplayModeMock,
  loadGlobalShortcut: loadGlobalShortcutMock,
  loadMenubarIconStyle: loadMenubarIconStyleMock,
  loadMenubarMetric: loadMenubarMetricMock,
  loadPluginSettings: loadPluginSettingsMock,
  loadResetTimerDisplayMode: loadResetTimerDisplayModeMock,
  loadStartOnLogin: loadStartOnLoginMock,
  loadThemeMode: loadThemeModeMock,
  loadTimeFormatMode: loadTimeFormatModeMock,
  migrateLegacyTraySettings: migrateLegacyTraySettingsMock,
  migrateRenamedPluginIds: migrateRenamedPluginIdsMock,
  normalizePluginSettings: normalizePluginSettingsMock,
  savePluginSettings: savePluginSettingsMock,
}))

import { useSettingsBootstrap } from "@/hooks/app/use-settings-bootstrap"

function createArgs() {
  return {
    setPluginSettings: vi.fn(),
    setPluginsMeta: vi.fn(),
    setAutoUpdateInterval: vi.fn(),
    setThemeMode: vi.fn(),
    setDisplayMode: vi.fn(),
    setResetTimerDisplayMode: vi.fn(),
    setTimeFormatMode: vi.fn(),
    setGlobalShortcut: vi.fn(),
    setStartOnLogin: vi.fn(),
    setMenubarIconStyle: vi.fn(),
    setMenubarMetric: vi.fn(),
    setLoadingForPlugins: vi.fn(),
    setErrorForPlugins: vi.fn(),
    startBatch: vi.fn().mockResolvedValue(undefined),
  }
}

describe("useSettingsBootstrap", () => {
  beforeEach(() => {
    invokeMock.mockReset()
    isTauriMock.mockReset()
    isAutostartEnabledMock.mockReset()
    enableAutostartMock.mockReset()
    disableAutostartMock.mockReset()
    arePluginSettingsEqualMock.mockReset()
    getEnabledPluginIdsMock.mockReset()
    loadAutoUpdateIntervalMock.mockReset()
    loadDisplayModeMock.mockReset()
    loadGlobalShortcutMock.mockReset()
    loadMenubarIconStyleMock.mockReset()
    loadMenubarMetricMock.mockReset()
    loadPluginSettingsMock.mockReset()
    loadResetTimerDisplayModeMock.mockReset()
    loadStartOnLoginMock.mockReset()
    loadThemeModeMock.mockReset()
    loadTimeFormatModeMock.mockReset()
    migrateLegacyTraySettingsMock.mockReset()
    migrateRenamedPluginIdsMock.mockReset()
    normalizePluginSettingsMock.mockReset()
    savePluginSettingsMock.mockReset()

    isTauriMock.mockReturnValue(true)
    isAutostartEnabledMock.mockResolvedValue(true)
    invokeMock.mockResolvedValue([
      {
        id: "codex",
        name: "Codex",
        iconUrl: "/codex.svg",
        brandColor: "#000000",
        lines: [],
        primaryCandidates: [],
      },
    ])
    loadPluginSettingsMock.mockResolvedValue({ order: ["codex"], disabled: [] })
    normalizePluginSettingsMock.mockImplementation((stored) => stored)
    arePluginSettingsEqualMock.mockReturnValue(true)
    loadAutoUpdateIntervalMock.mockResolvedValue(15)
    loadThemeModeMock.mockResolvedValue("dark")
    loadDisplayModeMock.mockResolvedValue("used")
    loadResetTimerDisplayModeMock.mockResolvedValue("relative")
    loadTimeFormatModeMock.mockResolvedValue("auto")
    loadGlobalShortcutMock.mockResolvedValue("CommandOrControl+Shift+O")
    loadMenubarIconStyleMock.mockResolvedValue("watchtower")
    loadMenubarMetricMock.mockResolvedValue("default")
    loadStartOnLoginMock.mockResolvedValue(true)
    migrateLegacyTraySettingsMock.mockResolvedValue(undefined)
    migrateRenamedPluginIdsMock.mockImplementation((settings) => settings)
    savePluginSettingsMock.mockResolvedValue(undefined)
    getEnabledPluginIdsMock.mockReturnValue(["codex"])
  })

  it("skips autostart changes when not running in Tauri", async () => {
    isTauriMock.mockReturnValue(false)
    const args = createArgs()
    const { result } = renderHook(() => useSettingsBootstrap(args))

    await result.current.applyStartOnLogin(true)

    expect(isAutostartEnabledMock).not.toHaveBeenCalled()
    expect(enableAutostartMock).not.toHaveBeenCalled()
    expect(disableAutostartMock).not.toHaveBeenCalled()
  })

  it("disables autostart when applyStartOnLogin receives false", async () => {
    const args = createArgs()
    const { result } = renderHook(() => useSettingsBootstrap(args))

    await result.current.applyStartOnLogin(false)

    expect(disableAutostartMock).toHaveBeenCalledTimes(1)
    expect(enableAutostartMock).not.toHaveBeenCalled()
  })

  it("enables autostart when applyStartOnLogin receives true and autostart is off", async () => {
    const args = createArgs()
    isAutostartEnabledMock.mockResolvedValueOnce(false)
    const { result } = renderHook(() => useSettingsBootstrap(args))

    await result.current.applyStartOnLogin(true)

    expect(enableAutostartMock).toHaveBeenCalledTimes(1)
    expect(disableAutostartMock).not.toHaveBeenCalled()
  })

  it("applies fixed display defaults and the stored theme mode", async () => {
    const args = createArgs()
    loadThemeModeMock.mockResolvedValueOnce("light")

    renderHook(() => useSettingsBootstrap(args))

    await waitFor(() => {
      expect(args.setAutoUpdateInterval).toHaveBeenCalledWith(5)
      expect(args.setThemeMode).toHaveBeenCalledWith("light")
      expect(args.setDisplayMode).toHaveBeenCalledWith("left")
      expect(args.setResetTimerDisplayMode).toHaveBeenCalledWith("relative")
      expect(args.setTimeFormatMode).toHaveBeenCalledWith("auto")
      expect(args.setGlobalShortcut).toHaveBeenCalledWith("CommandOrControl+W")
      expect(args.setStartOnLogin).toHaveBeenCalledWith(true)
      expect(args.setMenubarIconStyle).toHaveBeenCalledWith("watchtower")
      expect(args.setMenubarMetric).toHaveBeenCalledWith("default")
    })
  })

  it("normalizes stored settings and saves the first-launch result", async () => {
    const args = createArgs()
    const storedSettings = { order: ["copilot"], disabled: [] }
    const normalizedSettings = { order: ["codex"], disabled: ["gemini"] }
    const availablePlugins = [
      {
        id: "codex",
        name: "Codex",
        iconUrl: "/codex.svg",
        brandColor: "#000000",
        lines: [],
        primaryCandidates: [],
      },
      {
        id: "gemini",
        name: "Gemini",
        iconUrl: "/gemini.svg",
        brandColor: "#4285F4",
        lines: [],
        primaryCandidates: [],
      },
    ]

    invokeMock.mockResolvedValueOnce(availablePlugins)
    loadPluginSettingsMock.mockResolvedValueOnce(storedSettings)
    migrateRenamedPluginIdsMock.mockReturnValueOnce(storedSettings)
    normalizePluginSettingsMock.mockReturnValueOnce(normalizedSettings)
    arePluginSettingsEqualMock.mockReturnValueOnce(false)
    getEnabledPluginIdsMock.mockReturnValueOnce(["codex"])

    renderHook(() => useSettingsBootstrap(args))

    await waitFor(() => {
      expect(normalizePluginSettingsMock).toHaveBeenCalledWith(
        storedSettings,
        availablePlugins
      )
      expect(savePluginSettingsMock).toHaveBeenCalledWith(normalizedSettings)
      expect(args.setPluginSettings).toHaveBeenCalledWith(normalizedSettings)
      expect(args.startBatch).toHaveBeenCalledWith(["codex"])
    })
  })

  it("logs start-on-login failures without aborting bootstrap", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const args = createArgs()
    enableAutostartMock.mockRejectedValueOnce(new Error("autostart failed"))
    isAutostartEnabledMock.mockResolvedValueOnce(false)

    renderHook(() => useSettingsBootstrap(args))

    await waitFor(() => {
      expect(args.setPluginSettings).toHaveBeenCalled()
    })
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to apply start on login setting:",
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it("logs legacy tray migration failures without aborting bootstrap", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const args = createArgs()
    migrateLegacyTraySettingsMock.mockRejectedValueOnce(new Error("migration failed"))

    renderHook(() => useSettingsBootstrap(args))

    await waitFor(() => {
      expect(args.setPluginSettings).toHaveBeenCalled()
    })
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to migrate legacy tray settings:",
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it("marks plugins errored when the initial probe batch fails to start", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const args = createArgs()
    args.startBatch.mockRejectedValueOnce(new Error("batch failed"))

    renderHook(() => useSettingsBootstrap(args))

    await waitFor(() => {
      expect(args.setErrorForPlugins).toHaveBeenCalledWith(["codex"], "Failed to start probe")
    })
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to start probe batch:",
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it("ignores bootstrap results after unmount", async () => {
    let resolvePlugins: ((value: unknown) => void) | undefined
    invokeMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePlugins = resolve
      })
    )
    const args = createArgs()
    const { unmount } = renderHook(() => useSettingsBootstrap(args))

    unmount()
    resolvePlugins?.([
      {
        id: "codex",
        name: "Codex",
        iconUrl: "/codex.svg",
        brandColor: "#000000",
        lines: [],
        primaryCandidates: [],
      },
    ])
    await waitFor(() => {
      expect(args.setPluginsMeta).not.toHaveBeenCalled()
      expect(args.setPluginSettings).not.toHaveBeenCalled()
    })
  })

  it("skips probe error state when unmounted before the initial batch fails", async () => {
    let rejectBatch: ((error: Error) => void) | undefined
    const args = createArgs()
    args.startBatch.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectBatch = reject
      })
    )
    const { unmount } = renderHook(() => useSettingsBootstrap(args))

    await waitFor(() => {
      expect(args.setLoadingForPlugins).toHaveBeenCalledWith(["codex"])
    })

    unmount()
    rejectBatch?.(new Error("batch failed"))
    await waitFor(() => {
      expect(args.setErrorForPlugins).not.toHaveBeenCalled()
    })
  })

  it("stops applying settings after unmount", async () => {
    let resolveAutostart: (() => void) | undefined
    enableAutostartMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAutostart = resolve
        })
    )
    isAutostartEnabledMock.mockResolvedValueOnce(false)

    const args = createArgs()
    const { unmount } = renderHook(() => useSettingsBootstrap(args))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled()
      expect(enableAutostartMock).toHaveBeenCalled()
    })

    unmount()
    resolveAutostart?.()
    await waitFor(() => {
      expect(migrateLegacyTraySettingsMock).toHaveBeenCalled()
    })

    expect(args.setPluginSettings).not.toHaveBeenCalled()
    expect(args.startBatch).not.toHaveBeenCalled()
  })

  it("logs plugin settings load failures", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const args = createArgs()
    invokeMock.mockRejectedValueOnce(new Error("list plugins failed"))

    renderHook(() => useSettingsBootstrap(args))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load plugin settings:",
        expect.any(Error)
      )
    })

    consoleSpy.mockRestore()
  })
})
