import { useCallback, useEffect, useRef, useState } from "react"
import { invoke, isTauri } from "@tauri-apps/api/core"
import {
  getEnabledPluginIds,
  type AutoUpdateIntervalMinutes,
  type PluginSettings,
} from "@/lib/settings"
import { pollIntervalMs } from "@/lib/probe-schedule"

type UseProbeAutoUpdateArgs = {
  pluginSettings: PluginSettings | null
  autoUpdateInterval: AutoUpdateIntervalMinutes
  panelVisible?: boolean
  isDataStale?: () => boolean
  setLoadingForPlugins: (ids: string[]) => void
  setErrorForPlugins: (ids: string[], error: string) => void
  isPluginLoading: (id: string) => boolean
  startBatch: (pluginIds?: string[]) => Promise<string[] | undefined>
}

const DATA_IS_FRESH = () => false

async function readOnBattery(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const status = await invoke<{ onBattery?: boolean }>("power_status")
    return status?.onBattery === true
  } catch (error) {
    console.error("Failed to read power status:", error)
    return false
  }
}

export function useProbeAutoUpdate({
  pluginSettings,
  autoUpdateInterval,
  panelVisible = true,
  isDataStale = DATA_IS_FRESH,
  setLoadingForPlugins,
  setErrorForPlugins,
  isPluginLoading,
  startBatch,
}: UseProbeAutoUpdateArgs) {
  const [autoUpdateNextAt, setAutoUpdateNextAt] = useState<number | null>(null)
  const [autoUpdateResetToken, setAutoUpdateResetToken] = useState(0)
  const panelVisibleRef = useRef(panelVisible)
  const onBatteryRef = useRef(false)

  useEffect(() => {
    if (!pluginSettings) {
      setAutoUpdateNextAt(null)
      return
    }

    const enabledIds = getEnabledPluginIds(pluginSettings)
    if (enabledIds.length === 0) {
      setAutoUpdateNextAt(null)
      return
    }

    let cancelled = false
    let timer = 0
    const opened = panelVisible && !panelVisibleRef.current
    panelVisibleRef.current = panelVisible

    const runPoll = () => {
      const idleIds = enabledIds.filter((id) => !isPluginLoading(id))
      if (idleIds.length === 0) return
      setLoadingForPlugins(idleIds)
      startBatch(idleIds).catch((error) => {
        console.error("Failed to start auto-update batch:", error)
        setErrorForPlugins(idleIds, "Failed to start probe")
      })
    }

    if (opened && isDataStale()) {
      runPoll()
    }

    const arm = (onBattery: boolean) => {
      window.clearTimeout(timer)
      const delay = pollIntervalMs(autoUpdateInterval * 60_000, panelVisible, onBattery)
      setAutoUpdateNextAt(Date.now() + delay)
      timer = window.setTimeout(() => {
        runPoll()
        arm(onBatteryRef.current)
      }, delay)
    }

    arm(onBatteryRef.current)

    void readOnBattery().then((onBattery) => {
      if (cancelled || onBattery === onBatteryRef.current) return
      onBatteryRef.current = onBattery
      arm(onBattery)
    })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    autoUpdateInterval,
    autoUpdateResetToken,
    isDataStale,
    isPluginLoading,
    panelVisible,
    pluginSettings,
    setErrorForPlugins,
    setLoadingForPlugins,
    startBatch,
  ])

  const resetAutoUpdateSchedule = useCallback(() => {
    if (!pluginSettings) return
    const enabledIds = getEnabledPluginIds(pluginSettings)
    if (enabledIds.length === 0) {
      setAutoUpdateNextAt(null)
      return
    }

    setAutoUpdateNextAt(
      Date.now() + pollIntervalMs(autoUpdateInterval * 60_000, panelVisibleRef.current, onBatteryRef.current)
    )
    setAutoUpdateResetToken((value) => value + 1)
  }, [autoUpdateInterval, pluginSettings])

  return {
    autoUpdateNextAt,
    setAutoUpdateNextAt,
    resetAutoUpdateSchedule,
  }
}
