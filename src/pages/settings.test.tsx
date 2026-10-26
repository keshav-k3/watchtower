import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SettingsPage } from "@/pages/settings"

const { globalShortcutSectionMock } = vi.hoisted(() => ({
  globalShortcutSectionMock: vi.fn(),
}))

vi.mock("@/components/global-shortcut-section", () => ({
  GlobalShortcutSection: (props: unknown) => {
    globalShortcutSectionMock(props)
    return <div data-testid="global-shortcut-section" />
  },
}))

describe("SettingsPage", () => {
  it("renders the global shortcut section", () => {
    const onGlobalShortcutChange = vi.fn()
    render(
      <SettingsPage
        globalShortcut="CommandOrControl+W"
        onGlobalShortcutChange={onGlobalShortcutChange}
      />
    )

    expect(screen.getByTestId("global-shortcut-section")).toBeInTheDocument()
    expect(globalShortcutSectionMock).toHaveBeenCalledWith({
      globalShortcut: "CommandOrControl+W",
      onGlobalShortcutChange,
    })
    expect(screen.getByRole("heading", { name: "Providers" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Shortcut" })).toBeInTheDocument()
  })

  it("toggles a provider from the default handler", async () => {
    render(
      <SettingsPage
        globalShortcut={null}
        onGlobalShortcutChange={vi.fn()}
        pluginsMeta={[
          {
            id: "codex",
            name: "Codex",
            iconUrl: "",
            lines: [],
            primaryCandidates: [],
          },
        ]}
        pluginSettings={{ order: ["codex"], disabled: [] }}
      />
    )
    await userEvent.click(screen.getByRole("switch", { name: /Codex/ }))
  })
})
