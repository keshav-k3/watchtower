import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProviderIcon } from "@/components/provider-icon"

describe("ProviderIcon", () => {
  it.each(["codex", "devin", "grok-bot"])(
    "uses the theme-aware monochrome template for %s",
    (id) => {
      render(
        <ProviderIcon
          id={id}
          name={id}
          iconUrl={`/${id}.svg`}
          brandColor="#ffffff"
          active
        />
      )

      expect(screen.getByRole("img", { name: id })).toHaveStyle({
        backgroundColor: "var(--provider-icon-monochrome)",
      })
    }
  )

  it("keeps a plugin's brand color when it has no official mark", () => {
    render(
      <ProviderIcon
        id="custom"
        name="Custom"
        iconUrl="/custom.svg"
        brandColor="#ff0000"
      />
    )

    expect(screen.getByRole("img", { name: "Custom" })).toHaveStyle({
      backgroundColor: "#ff0000",
      opacity: "0.72",
    })
  })

  it("renders official color artwork as an image", () => {
    render(<ProviderIcon id="claude" name="Claude" iconUrl="/ignored.svg" />)
    const icon = screen.getByRole("img", { name: "Claude" })
    expect(icon.tagName).toBe("IMG")
    expect(icon.getAttribute("src")).toContain("hsl(14.8")
  })

  it("ships light and dark official artwork so CSS can follow the theme", () => {
    render(<ProviderIcon id="kimi" name="Kimi" />)
    const icon = screen.getByRole("img", { name: "Kimi" })
    const [light, dark] = Array.from(icon.querySelectorAll("img"))
    expect(light.getAttribute("src")).toContain("fill='black'")
    expect(light.className).toContain("dark:hidden")
    expect(dark.getAttribute("src")).toContain("fill='white'")
    expect(dark.className).toContain("dark:block")
  })

  it("renders an empty mask when a custom provider has no icon", () => {
    render(<ProviderIcon id="custom" name="Custom" />)
    expect(screen.getByRole("img", { name: "Custom" }).getAttribute("style")).toBeNull()
  })
})
