import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProviderIcon } from "@/components/provider-icon"

describe("ProviderIcon", () => {
  it.each(["codex", "devin", "grok"])(
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

  it("uses the dark official artwork when the theme is dark", () => {
    document.documentElement.classList.add("dark")
    render(<ProviderIcon id="kimi" name="Kimi" />)
    expect(screen.getByRole("img", { name: "Kimi" }).getAttribute("src")).toContain("fill='white'")
    document.documentElement.classList.remove("dark")
  })

  it("uses the light official artwork by default", () => {
    render(<ProviderIcon id="kimi" name="Kimi" />)
    expect(screen.getByRole("img", { name: "Kimi" }).getAttribute("src")).toContain("fill='black'")
  })

  it("renders an empty mask when a custom provider has no icon", () => {
    render(<ProviderIcon id="custom" name="Custom" />)
    expect(screen.getByRole("img", { name: "Custom" }).getAttribute("style")).toBeNull()
  })
})
