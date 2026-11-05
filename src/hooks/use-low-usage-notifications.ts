import { useEffect, useRef, useState } from "react"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import { detectLowUsage, type LowUsageProvider } from "@/lib/low-usage"
import { sendNativeNotification } from "@/lib/notify"
import { loadLowUsageAlerted, loadLowUsageAlerts, saveLowUsageAlerted } from "@/lib/settings"
import type { PluginState } from "@/hooks/app/types"

function providersFrom(states: Record<string, PluginState>): LowUsageProvider[] {
  return Object.entries(states).flatMap(([providerId, state]) =>
    state.data ? [{ providerId, name: state.data.displayName, lines: state.data.lines }] : []
  )
}

// Sends one native notification when a provider drops below the chosen share
// left, and stays quiet for that limit until it recovers. Off by default.
export function useLowUsageNotifications(pluginStates: Record<string, PluginState>) {
  const settings = useAppPreferencesStore((state) => state.lowUsageAlerts)
  const setSettings = useAppPreferencesStore((state) => state.setLowUsageAlerts)
  const [ready, setReady] = useState(false)
  const alertedRef = useRef<string[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadLowUsageAlerts(), loadLowUsageAlerted()])
      .then(([stored, alerted]) => {
        if (cancelled) return
        setSettings(stored)
        alertedRef.current = alerted
      })
      .catch((error) => {
        console.error("Failed to load low usage alerts:", error)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [setSettings])

  useEffect(() => {
    if (!ready || !settings.enabled) return
    const result = detectLowUsage(alertedRef.current, providersFrom(pluginStates), settings.thresholdPercent)
    const changed = result.alerted.join("\n") !== alertedRef.current.join("\n")
    alertedRef.current = result.alerted
    if (changed) {
      void saveLowUsageAlerted(result.alerted).catch((error) => {
        console.error("Failed to save low usage alerts:", error)
      })
    }
    for (const alert of result.alerts) {
      void sendNativeNotification(alert.title, alert.body)
    }
  }, [pluginStates, ready, settings])
}
