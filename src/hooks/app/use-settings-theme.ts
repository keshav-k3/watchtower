import { useEffect } from "react"
import type { ThemeMode } from "@/lib/settings"

export function useSettingsTheme(themeMode: ThemeMode) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add("dark")
  }, [themeMode])
}
