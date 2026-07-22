import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const panelState = vi.hoisted(() => ({
  canScrollDown: false,
  maxPanelHeightPx: 320 as number | null,
}))

vi.mock("@/components/app/app-content", () => ({
  AppContent: () => <div data-testid="app-content" />,
}))

vi.mock("@/components/panel-footer", () => ({
  PanelFooter: ({
    onShowAbout,
    onCloseAbout,
    showAbout,
  }: {
    onShowAbout: () => void
    onCloseAbout: () => void
    showAbout: boolean
  }) => (
    <div data-testid="panel-footer">
      <button type="button" onClick={onShowAbout}>
        Show About
      </button>
      <button type="button" onClick={onCloseAbout}>
        Close About
      </button>
      {showAbout ? <div>About Open</div> : null}
    </div>
  ),
}))

vi.mock("@/components/side-nav", () => ({
  SideNav: () => <nav data-testid="side-nav" />,
}))

vi.mock("@/hooks/app/use-panel", () => ({
  usePanel: () => ({
    containerRef: { current: null },
    scrollRef: { current: null },
    canScrollDown: panelState.canScrollDown,
    maxPanelHeightPx: panelState.maxPanelHeightPx,
  }),
}))

vi.mock("@/hooks/app/use-app-version", () => ({
  useAppVersion: () => "0.0.0",
}))

vi.mock("@/hooks/use-app-update", () => ({
  useAppUpdate: () => ({
    updateStatus: { status: "idle" },
    triggerInstall: vi.fn(),
    checkForUpdates: vi.fn(),
  }),
}))

import { AppShell } from "@/components/app/app-shell"
import type { AppContentActionProps } from "@/components/app/app-content"
import type { PluginMeta } from "@/lib/plugin-types"
import { useAppUiStore } from "@/stores/app-ui-store"

function createPlugin(id: string, name: string): PluginMeta {
  return {
    id,
    name,
    iconUrl: `/${id}.svg`,
    brandColor: "#ffffff",
    lines: [],
    primaryCandidates: [],
  }
}

function createProps() {
  const pluginsMeta = [
    createPlugin("cursor", "Cursor"),
    createPlugin("codex", "Codex"),
    createPlugin("claude", "Claude"),
    createPlugin("opencode", "OpenCode"),
    createPlugin("gemini", "Gemini"),
  ]

  return {
    onRefreshAll: vi.fn(),
    navPlugins: [],
    pluginsMeta,
    pluginSettings: {
      order: pluginsMeta.map((plugin) => plugin.id),
      disabled: [],
    },
    displayPlugins: [],
    autoUpdateNextAt: null,
    selectedPlugin: null,
    themeMode: "dark" as const,
    onThemeModeChange: vi.fn(),
    onPluginContextAction: vi.fn(),
    isPluginRefreshAvailable: vi.fn(() => true),
    onNavReorder: vi.fn(),
    onProviderToggle: vi.fn(),
    appContentProps: {
      onRetryPlugin: vi.fn(),
      onResetTimerDisplayModeToggle: vi.fn(),
      onGlobalShortcutChange: vi.fn(),
    } satisfies AppContentActionProps,
  }
}

describe("AppShell", () => {
  beforeEach(() => {
    panelState.canScrollDown = false
    panelState.maxPanelHeightPx = 320
    useAppUiStore.getState().resetState()
  })

  it("keeps provider settings usable when the panel height is capped", async () => {
    render(<AppShell {...createProps()} />)

    await userEvent.click(screen.getByRole("button", { name: "Provider Settings" }))

    const popover = screen.getByText("Providers").parentElement?.parentElement

    expect(popover).toHaveClass("max-h-[calc(100%-4rem)]")
    expect(popover).toHaveClass("overflow-y-auto")
  })

  it("toggles provider settings from the header button", async () => {
    render(<AppShell {...createProps()} />)

    expect(screen.queryByText("Providers")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Provider Settings" }))
    expect(screen.getByText("Providers")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Provider Settings" }))
    expect(screen.queryByText("Providers")).not.toBeInTheDocument()
  })

  it("wires about dialog open and close through the footer", async () => {
    render(<AppShell {...createProps()} />)

    expect(screen.queryByText("About Open")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Show About" }))
    expect(screen.getByText("About Open")).toBeInTheDocument()
    expect(useAppUiStore.getState().showAbout).toBe(true)

    await userEvent.click(screen.getByRole("button", { name: "Close About" }))
    expect(screen.queryByText("About Open")).not.toBeInTheDocument()
    expect(useAppUiStore.getState().showAbout).toBe(false)
  })

  it("calls refresh all from the header button", async () => {
    const props = createProps()
    render(<AppShell {...props} />)

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(props.onRefreshAll).toHaveBeenCalledTimes(1)
  })

  it("renders the theme-aware Watchtower mark instead of the fixed-color app image", () => {
    const { container } = render(<AppShell {...createProps()} />)

    expect(container.querySelector('header img[src="/icon.png"]')).toBeNull()
    expect(container.querySelector('header svg[fill="currentColor"]')).toBeTruthy()
  })

  it("stretches the sidebar rail to the full panel height", () => {
    render(<AppShell {...createProps()} />)

    expect(screen.getByTestId("side-nav").parentElement?.className).toContain("items-stretch")
  })

  it("places the theme toggle between refresh and settings", async () => {
    const props = createProps()
    render(<AppShell {...props} />)

    const refresh = screen.getByRole("button", { name: "Refresh" })
    const theme = screen.getByRole("button", { name: "Switch To Light Theme" })
    const settings = screen.getByRole("button", { name: "Provider Settings" })
    const buttons = screen.getAllByRole("button")
    const headerButtons = buttons.filter((button) =>
      ["Refresh", "Switch To Light Theme", "Provider Settings"].includes(
        button.getAttribute("aria-label") ?? ""
      )
    )

    expect(headerButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Refresh",
      "Switch To Light Theme",
      "Provider Settings",
    ])
    expect(theme.className).toContain("size-8")
    expect(settings.className).toContain("size-8")
    expect(refresh.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(theme.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await userEvent.click(theme)
    expect(props.onThemeModeChange).toHaveBeenCalledWith("light")
  })

  it("wires the light-theme toggle back to dark", async () => {
    const props = createProps()
    props.themeMode = "light"
    render(<AppShell {...props} />)

    const theme = screen.getByRole("button", { name: "Switch To Dark Theme" })
    expect(theme.className).toContain("size-8")
    expect(theme.className).toContain("bg-surface")

    await userEvent.click(theme)
    expect(props.onThemeModeChange).toHaveBeenCalledWith("dark")
  })

  it("omits the max-height style when panel height is unavailable", () => {
    panelState.maxPanelHeightPx = null
    const { container } = render(<AppShell {...createProps()} />)

    expect(container.querySelector("[style*='max-height']")).toBeNull()
  })

  it("shows the scroll fade when more content is available below", () => {
    panelState.canScrollDown = true
    const { container } = render(<AppShell {...createProps()} />)

    expect(container.querySelector(".opacity-100")).toBeTruthy()
  })
})
