import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProviderIcon } from "@/components/provider-icon"

describe("ProviderIcon", () => {
  it.each(["codex", "claude", "kiro", "grok-bot", "custom"])(
    "draws %s as a theme-ink mask of its plugin mark",
    (id) => {
      render(<ProviderIcon id={id} name={id} iconUrl={`/${id}.svg`} brandColor="#ff0000" active />)
      const icon = screen.getByRole("img", { name: id })
      expect(icon).toHaveStyle({
        backgroundColor: "var(--provider-icon-monochrome)",
        opacity: "1",
      })
      expect(icon.getAttribute("style")).toContain(`/${id}.svg`)
    }
  )

  it("dims inactive marks", () => {
    render(<ProviderIcon id="custom" name="Custom" iconUrl='/a"b.svg' />)
    const icon = screen.getByRole("img", { name: "Custom" })
    expect(icon).toHaveStyle({ opacity: "0.72" })
    expect(icon.getAttribute("style")).toContain("a%22b.svg")
  })

  it("renders an empty mask when a provider has no icon", () => {
    render(<ProviderIcon id="custom" name="Custom" />)
    expect(screen.getByRole("img", { name: "Custom" }).getAttribute("style")).toBeNull()
  })
})
