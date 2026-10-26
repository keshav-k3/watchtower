import { useEffect, useRef, useState } from "react"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import {
  codexWindowsFromLines,
  detectCodexResets,
  type CodexWindowSnapshot,
} from "@/lib/codex-reset"
import { loadCodexResetSnapshot, saveCodexResetSnapshot } from "@/lib/settings"
import type { MetricLine } from "@/lib/plugin-types"

async function sendNativeNotification(message: string) {
  try {
    const mod = await import("@tauri-apps/plugin-notification")
    let granted = await mod.isPermissionGranted()
    if (!granted) {
      granted = (await mod.requestPermission()) === "granted"
    }
    if (!granted) {
      console.error("Codex reset notification permission was denied")
      return
    }
    mod.sendNotification({ title: "Codex Limits Were Reset", body: message })
  } catch (error) {
    console.error("Failed to send Codex reset notification:", error)
  }
}

export function useCodexResetNotifications(lines: MetricLine[] | null) {
  const enabled = useAppPreferencesStore((state) => state.codexResetNotifications)
  const [message, setMessage] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const snapshotRef = useRef<CodexWindowSnapshot[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadCodexResetSnapshot()
      .then((snapshot) => {
        if (cancelled) return
        snapshotRef.current = snapshot
        setReady(true)
      })
      .catch((error) => {
        console.error("Failed to load Codex reset history:", error)
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready || !lines) return
    const next = codexWindowsFromLines(lines)
    const alerts = enabled ? detectCodexResets(snapshotRef.current, next) : []
    snapshotRef.current = next
    void saveCodexResetSnapshot(next).catch((error) => {
      console.error("Failed to save Codex reset history:", error)
    })
    if (alerts.length === 0) return
    const text = alerts.join(". ")
    setMessage(text)
    void sendNativeNotification(text)
  }, [enabled, lines, ready])

  if (!message) return null

  return (
    <div
      role="status"
      className="mx-5 mb-2 rounded-[12px] border border-line bg-card px-3 py-2 text-sm shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-foreground">{message}</p>
        <button
          type="button"
          className="text-xs text-muted-foreground"
          onClick={() => setMessage(null)}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
