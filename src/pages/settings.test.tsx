import { render, screen } from "@testing-library/react"
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
  })
})
