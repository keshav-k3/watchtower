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

    // Listen first, then read: the backend only emits on changes, so a
    // show or hide between a read and a later listen would be lost.
    const sync = async () => {
      let sawEvent = false
      try {
        const stop = await listen<boolean>("panel:visibility", (event) => {
          if (typeof event.payload !== "boolean") return
          sawEvent = true
          setVisible(event.payload)
        })
        if (cancelled) {
          stop()
          return
        }
        unlisten = stop
      } catch (error) {
        console.error("Failed to listen for panel visibility:", error)
      }

      try {
        const current = await invoke<boolean>("panel_visible")
        // An event that arrived while reading is newer than the read.
        if (!cancelled && !sawEvent && typeof current === "boolean") setVisible(current)
      } catch (error) {
        console.error("Failed to read panel visibility:", error)
      }
    }

    void sync()

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [setVisible])
}
