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
  DEFAULT_THEME_MODE: "dark",
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

  it("disables autostart when applyStartOnLogin receives false", async () => {
    const args = createArgs()
    const { result } = renderHook(() => useSettingsBootstrap(args))

    await result.current.applyStartOnLogin(false)

    expect(disableAutostartMock).toHaveBeenCalledTimes(1)
    expect(enableAutostartMock).not.toHaveBeenCalled()
  })

  it("applies fixed display defaults", async () => {
    const args = createArgs()

    renderHook(() => useSettingsBootstrap(args))

    await waitFor(() => {
      expect(args.setAutoUpdateInterval).toHaveBeenCalledWith(5)
      expect(args.setThemeMode).toHaveBeenCalledWith("dark")
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
})
