import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/app/app-content", () => ({
  AppContent: () => <div data-testid="app-content" />,
}))

vi.mock("@/components/panel-footer", () => ({
  PanelFooter: () => <div data-testid="panel-footer" />,
}))

vi.mock("@/components/side-nav", () => ({
  SideNav: () => <nav data-testid="side-nav" />,
}))

vi.mock("@/hooks/app/use-panel", () => ({
  usePanel: () => ({
    containerRef: { current: null },
    scrollRef: { current: null },
    canScrollDown: false,
    maxPanelHeightPx: 320,
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
    onPluginContextAction: vi.fn(),
    isPluginRefreshAvailable: vi.fn(() => true),
    onNavReorder: vi.fn(),
    onProviderToggle: vi.fn(),
    appContentProps: {
      onRetryPlugin: vi.fn(),
      onResetTimerDisplayModeToggle: vi.fn(),
    } satisfies AppContentActionProps,
  }
}

describe("AppShell", () => {
  it("keeps provider settings usable when the panel height is capped", async () => {
    render(<AppShell {...createProps()} />)

    await userEvent.click(screen.getByRole("button", { name: "Provider Settings" }))

    const popover = screen.getByText("Providers").parentElement?.parentElement

    expect(popover).toHaveClass("max-h-[calc(100%-4rem)]")
    expect(popover).toHaveClass("overflow-y-auto")
  })
})
