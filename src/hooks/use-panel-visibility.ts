import { useEffect } from "react"
import { invoke, isTauri } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { usePanelVisibilityStore } from "@/stores/panel-visibility-store"

export function usePanelVisibility() {
  const setVisible = usePanelVisibilityStore((state) => state.setVisible)

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    let unlisten: (() => void) | undefined

    const sync = async () => {
      try {
        const current = await invoke<boolean>("panel_visible")
        if (!cancelled && typeof current === "boolean") setVisible(current)
      } catch (error) {
        console.error("Failed to read panel visibility:", error)
      }

      if (cancelled) return

      try {
        unlisten = await listen<boolean>("panel:visibility", (event) => {
          if (typeof event.payload === "boolean") setVisible(event.payload)
        })
      } catch (error) {
        console.error("Failed to listen for panel visibility:", error)
      }

      if (cancelled) unlisten?.()
    }

    void sync()

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [setVisible])
}
