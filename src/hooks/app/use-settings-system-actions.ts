import { useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  saveGlobalShortcut,
  type GlobalShortcut,
} from "@/lib/settings"

type UseSettingsSystemActionsArgs = {
  setGlobalShortcut: (value: GlobalShortcut) => void
}

export function useSettingsSystemActions({
  setGlobalShortcut,
}: UseSettingsSystemActionsArgs) {
  const handleGlobalShortcutChange = useCallback((value: GlobalShortcut) => {
    setGlobalShortcut(value)
    void saveGlobalShortcut(value).catch((error) => {
      console.error("Failed to save global shortcut:", error)
    })
    invoke("update_global_shortcut", { shortcut: value }).catch((error) => {
      console.error("Failed to update global shortcut:", error)
    })
  }, [setGlobalShortcut])

  return {
    handleGlobalShortcutChange,
  }
}
