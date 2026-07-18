import { useCallback, useEffect } from "react"
import { invoke, isTauri } from "@tauri-apps/api/core"
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart"
import type { PluginMeta } from "@/lib/plugin-types"
import {
  arePluginSettingsEqual,
  DEFAULT_AUTO_UPDATE_INTERVAL,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_GLOBAL_SHORTCUT,
  DEFAULT_MENUBAR_ICON_STYLE,
  DEFAULT_MENUBAR_METRIC,
  DEFAULT_RESET_TIMER_DISPLAY_MODE,
  DEFAULT_START_ON_LOGIN,
  DEFAULT_TIME_FORMAT_MODE,
  getEnabledPluginIds,
  loadThemeMode,
  migrateLegacyTraySettings,
  loadPluginSettings,
  migrateRenamedPluginIds,
  normalizePluginSettings,
  savePluginSettings,
  type AutoUpdateIntervalMinutes,
  type DisplayMode,
  type GlobalShortcut,
  type MenubarIconStyle,
  type MenubarMetric,
  type PluginSettings,
  type ResetTimerDisplayMode,
  type ThemeMode,
  type TimeFormatMode,
} from "@/lib/settings"

type UseSettingsBootstrapArgs = {
  setPluginSettings: (value: PluginSettings | null) => void
  setPluginsMeta: (value: PluginMeta[]) => void
  setAutoUpdateInterval: (value: AutoUpdateIntervalMinutes) => void
  setThemeMode: (value: ThemeMode) => void
  setDisplayMode: (value: DisplayMode) => void
  setResetTimerDisplayMode: (value: ResetTimerDisplayMode) => void
  setTimeFormatMode: (value: TimeFormatMode) => void
  setGlobalShortcut: (value: GlobalShortcut) => void
  setStartOnLogin: (value: boolean) => void
  setMenubarIconStyle: (value: MenubarIconStyle) => void
  setMenubarMetric: (value: MenubarMetric) => void
  setLoadingForPlugins: (ids: string[]) => void
  setErrorForPlugins: (ids: string[], error: string) => void
  startBatch: (pluginIds?: string[]) => Promise<string[] | undefined>
}

export function useSettingsBootstrap({
  setPluginSettings,
  setPluginsMeta,
  setAutoUpdateInterval,
  setThemeMode,
  setDisplayMode,
  setResetTimerDisplayMode,
  setTimeFormatMode,
  setGlobalShortcut,
  setStartOnLogin,
  setMenubarIconStyle,
  setMenubarMetric,
  setLoadingForPlugins,
  setErrorForPlugins,
  startBatch,
}: UseSettingsBootstrapArgs) {
  const applyStartOnLogin = useCallback(async (value: boolean) => {
    if (!isTauri()) return
    const currentlyEnabled = await isAutostartEnabled()
    if (currentlyEnabled === value) return

    if (value) {
      await enableAutostart()
      return
    }

    await disableAutostart()
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadSettings = async () => {
      try {
        const availablePlugins = await invoke<PluginMeta[]>("list_plugins")
        if (!isMounted) return
        setPluginsMeta(availablePlugins)

        const storedSettings = await loadPluginSettings()
        const renamedSettings = migrateRenamedPluginIds(storedSettings)
        const normalized = normalizePluginSettings(renamedSettings, availablePlugins)
        if (!arePluginSettingsEqual(storedSettings, normalized)) {
          await savePluginSettings(normalized)
        }

        const storedInterval = DEFAULT_AUTO_UPDATE_INTERVAL
        const storedThemeMode = await loadThemeMode()
        const storedDisplayMode = DEFAULT_DISPLAY_MODE
        const storedResetTimerDisplayMode = DEFAULT_RESET_TIMER_DISPLAY_MODE
        const storedTimeFormatMode = DEFAULT_TIME_FORMAT_MODE
        const storedGlobalShortcut = DEFAULT_GLOBAL_SHORTCUT
        const storedStartOnLogin = DEFAULT_START_ON_LOGIN

        try {
          await applyStartOnLogin(storedStartOnLogin)
        } catch (error) {
          console.error("Failed to apply start on login setting:", error)
        }
        try {
          await migrateLegacyTraySettings()
        } catch (error) {
          console.error("Failed to migrate legacy tray settings:", error)
        }

        const storedMenubarIconStyle = DEFAULT_MENUBAR_ICON_STYLE
        const storedMenubarMetric = DEFAULT_MENUBAR_METRIC

        if (!isMounted) {
          /* v8 ignore next */
          return
        }
        setPluginSettings(normalized)
        setAutoUpdateInterval(storedInterval)
        setThemeMode(storedThemeMode)
        setDisplayMode(storedDisplayMode)
        setResetTimerDisplayMode(storedResetTimerDisplayMode)
        setTimeFormatMode(storedTimeFormatMode)
        setGlobalShortcut(storedGlobalShortcut)
        setStartOnLogin(storedStartOnLogin)
        setMenubarIconStyle(storedMenubarIconStyle)
        setMenubarMetric(storedMenubarMetric)

        const enabledIds = getEnabledPluginIds(normalized)
        setLoadingForPlugins(enabledIds)
        try {
          await startBatch(enabledIds)
        } catch (error) {
          console.error("Failed to start probe batch:", error)
          if (isMounted) {
            setErrorForPlugins(enabledIds, "Failed to start probe")
          }
        }
      } catch (e) {
        console.error("Failed to load plugin settings:", e)
      }
    }

    loadSettings()

    return () => {
      isMounted = false
    }
  }, [
    applyStartOnLogin,
    setAutoUpdateInterval,
    setDisplayMode,
    setErrorForPlugins,
    setGlobalShortcut,
    setLoadingForPlugins,
    setMenubarIconStyle,
    setMenubarMetric,
    migrateLegacyTraySettings,
    setPluginSettings,
    setPluginsMeta,
    setResetTimerDisplayMode,
    setStartOnLogin,
    setThemeMode,
    setTimeFormatMode,
    startBatch,
  ])

  return {
    applyStartOnLogin,
  }
}
