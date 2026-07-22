import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProviderIcon } from "@/components/provider-icon"

describe("ProviderIcon", () => {
  it.each(["cursor", "codex", "opencode"])(
    "uses the theme-aware monochrome color for %s",
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

  it("keeps a plugin's brand color when it is not monochrome", () => {
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
    })
  })
})
