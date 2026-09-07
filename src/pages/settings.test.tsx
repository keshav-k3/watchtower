import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SettingsPage } from "@/pages/settings"

const { globalShortcutSectionMock, providerHomesSectionMock } = vi.hoisted(() => ({
  globalShortcutSectionMock: vi.fn(),
  providerHomesSectionMock: vi.fn(),
}))

vi.mock("@/components/global-shortcut-section", () => ({
  GlobalShortcutSection: (props: unknown) => {
    globalShortcutSectionMock(props)
    return <div data-testid="global-shortcut-section" />
  },
}))

vi.mock("@/components/provider-homes-section", () => ({
  ProviderHomesSection: (props: unknown) => {
    providerHomesSectionMock(props)
    return <div data-testid="provider-homes-section" />
  },
}))

describe("SettingsPage", () => {
  it("renders the global shortcut and extra accounts sections", () => {
    const onGlobalShortcutChange = vi.fn()
    const onAddProviderHome = vi.fn()
    const onRemoveProviderHome = vi.fn()
    const homes = [
      { id: "claude-work", pluginId: "claude" as const, name: "Claude Work", homePath: "~/.claude-work" },
    ]
    render(
      <SettingsPage
        globalShortcut="CommandOrControl+W"
        onGlobalShortcutChange={onGlobalShortcutChange}
        providerHomes={homes}
        onAddProviderHome={onAddProviderHome}
        onRemoveProviderHome={onRemoveProviderHome}
      />
    )

    expect(screen.getByTestId("global-shortcut-section")).toBeInTheDocument()
    expect(screen.getByTestId("provider-homes-section")).toBeInTheDocument()
    expect(globalShortcutSectionMock).toHaveBeenCalledWith({
      globalShortcut: "CommandOrControl+W",
      onGlobalShortcutChange,
    })
    expect(providerHomesSectionMock).toHaveBeenCalledWith({
      homes,
      onAdd: onAddProviderHome,
      onRemove: onRemoveProviderHome,
    })
  })
})
