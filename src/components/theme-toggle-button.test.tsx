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
})
