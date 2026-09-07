import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ProviderHomesSection } from "@/components/provider-homes-section"

describe("ProviderHomesSection", () => {
  it("adds a named Claude extra account", async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<ProviderHomesSection homes={[]} onAdd={onAdd} onRemove={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "Add Account" }))
    await user.clear(screen.getByLabelText("Name"))
    await user.type(screen.getByLabelText("Name"), "Claude Personal")
    await user.clear(screen.getByLabelText("Config Folder"))
    await user.type(screen.getByLabelText("Config Folder"), "~/.claude-personal")
    await user.click(screen.getByRole("button", { name: "Add Account" }))

    expect(onAdd).toHaveBeenCalledWith({
      pluginId: "claude",
      name: "Claude Personal",
      homePath: "~/.claude-personal",
    })
  })

  it("removes an extra account", async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(
      <ProviderHomesSection
        homes={[
          {
            id: "claude-work",
            pluginId: "claude",
            name: "Claude Work",
            homePath: "~/.claude-work",
          },
        ]}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />
    )

    await user.click(screen.getByRole("button", { name: "Remove Claude Work" }))
    expect(onRemove).toHaveBeenCalledWith("claude-work")
  })
})
