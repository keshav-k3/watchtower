import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useSettingsTheme } from "./use-settings-theme"

describe("useSettingsTheme", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark")
    vi.restoreAllMocks()
  })

  it("applies dark class for dark mode", () => {
    document.documentElement.classList.remove("dark")
    renderHook(() => useSettingsTheme("dark"))
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("removes dark class for light mode", () => {
    document.documentElement.classList.add("dark")
    renderHook(() => useSettingsTheme("light"))
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("follows system preference when theme mode is system", () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = []
    const matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark"),
      media: query,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.push(listener)
      },
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal("matchMedia", matchMedia)

    document.documentElement.classList.remove("dark")
    renderHook(() => useSettingsTheme("system"))
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    listeners[0]?.({ matches: false } as MediaQueryListEvent)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("updates the document class when theme mode changes", () => {
    document.documentElement.classList.remove("dark")
    const { rerender } = renderHook(
      ({ mode }: { mode: "light" | "dark" | "system" }) => useSettingsTheme(mode),
      { initialProps: { mode: "dark" as const } }
    )

    expect(document.documentElement.classList.contains("dark")).toBe(true)

    rerender({ mode: "light" })
    expect(document.documentElement.classList.contains("dark")).toBe(false)

    rerender({ mode: "dark" })
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })
})
