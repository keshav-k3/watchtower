import { useCallback, useEffect, useRef, useState } from "react"
import { invoke, isTauri } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow, PhysicalSize, currentMonitor } from "@tauri-apps/api/window"
import type { ActiveView } from "@/components/side-nav"
import type { DisplayPluginState } from "@/hooks/app/use-app-plugin-views"

const PANEL_WIDTH = 400
// The panel keeps one height on every page so the window doesn't jump when
// you switch views. Long pages scroll inside the panel; short pages leave
// space. On small screens it is capped to a share of the monitor height.
export const PANEL_HEIGHT_PX = 720
const MAX_HEIGHT_FALLBACK_PX = 600
const MAX_HEIGHT_FRACTION_OF_MONITOR = 0.8

type UsePanelArgs = {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
  showAbout: boolean
  setShowAbout: (value: boolean) => void
  displayPlugins: DisplayPluginState[]
}

function isEditableTarget(target: EventTarget | null): boolean {
  /* v8 ignore next */
  if (!(target instanceof HTMLElement)) return false

  /* v8 ignore start */
  if (target.isContentEditable) return true
  /* v8 ignore stop */
  if (target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")) {
    return true
  }

  return false
}

export function usePanel({
  activeView,
  setActiveView,
  showAbout,
  setShowAbout,
  displayPlugins,
}: UsePanelArgs) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const panelHeightPxRef = useRef<number | null>(null)
  const appliedSizeRef = useRef<{ width: number; height: number } | null>(null)
  const focusContainer = useCallback(() => {
    window.requestAnimationFrame(() => {
      containerRef.current?.focus({ preventScroll: true })
    })
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        focusContainer()
      }
    }

    window.addEventListener("focus", focusContainer)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", focusContainer)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [focusContainer])

  useEffect(() => {
    if (!isTauri()) return
    invoke("init_panel").catch(console.error)
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    if (showAbout) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        invoke("hide_panel")
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showAbout])

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    const unlisteners: (() => void)[] = []

    async function setup() {
      const u1 = await listen<string>("tray:navigate", (event) => {
        setActiveView(event.payload as ActiveView)
        focusContainer()
      })
      if (cancelled) {
        u1()
        return
      }
      unlisteners.push(u1)

      const u2 = await listen("tray:show-about", () => {
        setShowAbout(true)
        focusContainer()
      })
      if (cancelled) {
        u2()
        return
      }
      unlisteners.push(u2)
    }

    void setup()

    return () => {
      cancelled = true
      for (const fn of unlisteners) fn()
    }
  }, [focusContainer, setActiveView, setShowAbout])

  useEffect(() => {
    if (showAbout) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
      if (isEditableTarget(event.target)) return

      const views: ActiveView[] = ["home", ...displayPlugins.map((plugin) => plugin.meta.id)]
      /* v8 ignore next */
      if (views.length === 0) return

      let nextView: ActiveView | undefined

      const currentIndex = views.indexOf(activeView)
      if (currentIndex === -1) return
      const offset = event.key === "ArrowUp" ? -1 : 1
      nextView = views[(currentIndex + offset + views.length) % views.length]

      if (!nextView || nextView === activeView) return

      event.preventDefault()
      setActiveView(nextView)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeView, displayPlugins, setActiveView, showAbout])

  useEffect(() => {
    if (!isTauri()) return
    const container = containerRef.current
    if (!container) return

    const resizeWindow = async () => {
      const factor = window.devicePixelRatio
      const width = Math.ceil(PANEL_WIDTH * factor)

      let maxHeightLogical: number | null = null

      try {
        const monitor = await currentMonitor()
        if (monitor) {
          const maxHeightPhysical = Math.floor(monitor.size.height * MAX_HEIGHT_FRACTION_OF_MONITOR)
          maxHeightLogical = Math.floor(maxHeightPhysical / factor)
        }
      } catch {
        // fall through to fallback
      }

      if (maxHeightLogical === null) {
        const screenAvailHeight = Number(window.screen?.availHeight) || MAX_HEIGHT_FALLBACK_PX
        maxHeightLogical = Math.floor(screenAvailHeight * MAX_HEIGHT_FRACTION_OF_MONITOR)
      }

      const heightLogical = Math.min(PANEL_HEIGHT_PX, maxHeightLogical)
      if (panelHeightPxRef.current !== heightLogical) {
        panelHeightPxRef.current = heightLogical
        setPanelHeightPx(heightLogical)
      }

      const height = Math.ceil(heightLogical * factor)
      const applied = appliedSizeRef.current
      if (applied && applied.width === width && applied.height === height) return

      // Claim the size before awaiting so overlapping calls don't resize twice.
      appliedSizeRef.current = { width, height }
      try {
        const currentWindow = getCurrentWindow()
        await currentWindow.setSize(new PhysicalSize(width, height))
      } catch (e) {
        appliedSizeRef.current = null
        console.error("Failed to resize window:", e)
      }
    }

    resizeWindow()

    const observer = new ResizeObserver(() => {
      resizeWindow()
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [activeView, displayPlugins])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const check = () => {
      setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
    }

    check()
    el.addEventListener("scroll", check, { passive: true })

    const ro = new ResizeObserver(check)
    ro.observe(el)

    const mo = new MutationObserver(check)
    mo.observe(el, { childList: true, subtree: true })

    return () => {
      el.removeEventListener("scroll", check)
      ro.disconnect()
      mo.disconnect()
    }
  }, [activeView])

  return {
    containerRef,
    scrollRef,
    canScrollDown,
    panelHeightPx,
  }
}
