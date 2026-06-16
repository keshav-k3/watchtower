import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ProviderSettingsPopover } from "@/components/provider-settings-popover"

vi.mock("@/components/provider-icon", () => ({
  ProviderIcon: ({ name }: { name: string }) => <span>{name} icon</span>,
}))

describe("ProviderSettingsPopover", () => {
  it("returns null when plugin settings are missing", () => {
    const { container } = render(
      <ProviderSettingsPopover
        pluginsMeta={[]}
        pluginSettings={null}
        onProviderToggle={vi.fn()}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("renders ordered providers and calls onProviderToggle when clicked", async () => {
    const onProviderToggle = vi.fn()

    render(
      <ProviderSettingsPopover
        pluginsMeta={[
          {
            id: "codex",
            name: "Codex",
            iconUrl: "",
            brandColor: "#000000",
            lines: [],
            primaryCandidates: [],
          },
          {
            id: "claude",
            name: "Claude",
            iconUrl: "",
            brandColor: "#000000",
            lines: [],
            primaryCandidates: [],
          },
        ]}
        pluginSettings={{ order: ["codex", "claude", "missing"], disabled: ["claude"] }}
        onProviderToggle={onProviderToggle}
      />
    )

    expect(screen.getByText("Providers")).toBeInTheDocument()
    expect(screen.getByText("Toggle Visibility")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Codex/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Claude/ })).toBeInTheDocument()
    expect(screen.queryByText("missing")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /Codex/ }))
    expect(onProviderToggle).toHaveBeenCalledWith("codex")
  })
})
