import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ThemeToggleButton } from "@/components/theme-toggle-button"

describe("ThemeToggleButton", () => {
  it("offers Switch To Light Theme while dark is active", async () => {
    const onThemeModeChange = vi.fn()
    render(<ThemeToggleButton themeMode="dark" onThemeModeChange={onThemeModeChange} />)

    await userEvent.click(screen.getByRole("button", { name: "Switch To Light Theme" }))
    expect(onThemeModeChange).toHaveBeenCalledWith("light")
  })

  it("offers Switch To Dark Theme while light is active", async () => {
    const onThemeModeChange = vi.fn()
    render(<ThemeToggleButton themeMode="light" onThemeModeChange={onThemeModeChange} />)

    await userEvent.click(screen.getByRole("button", { name: "Switch To Dark Theme" }))
    expect(onThemeModeChange).toHaveBeenCalledWith("dark")
  })

  it("treats system theme as non-light and switches to light", async () => {
    const onThemeModeChange = vi.fn()
    render(<ThemeToggleButton themeMode="system" onThemeModeChange={onThemeModeChange} />)

    const button = screen.getByRole("button", { name: "Switch To Light Theme" })
    expect(button).toHaveAttribute("title", "Switch To Light Theme")
    await userEvent.click(button)
    expect(onThemeModeChange).toHaveBeenCalledWith("light")
  })

  it("matches the Settings button surface styling", () => {
    render(<ThemeToggleButton themeMode="dark" onThemeModeChange={vi.fn()} />)

    const button = screen.getByRole("button", { name: "Switch To Light Theme" })
    expect(button.className).toContain("size-8")
    expect(button.className).toContain("bg-surface")
    expect(button.className).toContain("rounded-[10px]")
    expect(button.className).toContain("border-line")
  })
})
