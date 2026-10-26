import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkSquare02Icon } from "@hugeicons-pro/core-solid-rounded"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import {
  codexWindowsFromLines,
  detectCodexResets,
  type CodexWindowSnapshot,
} from "@/lib/codex-reset"
import { loadCodexResetSnapshot, saveCodexResetSnapshot } from "@/lib/settings"
import type { MetricLine } from "@/lib/plugin-types"

const AUTO_DISMISS_MS = 8000

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

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div
      role="status"
      className="mx-3 mb-1 flex items-center gap-2 border-y border-line bg-surface px-2 py-1.5"
    >
      <HugeiconsIcon icon={CheckmarkSquare02Icon} className="size-3.5 shrink-0 text-foreground" />
      <p className="min-w-0 flex-1 break-words text-[12px] leading-4 text-foreground">{message}</p>
      <button
        type="button"
        className="shrink-0 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => setMessage(null)}
      >
        Dismiss
      </button>
    </div>
  )
}
