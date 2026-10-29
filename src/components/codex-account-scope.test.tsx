import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const storeState = new Map<string, unknown>()

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    async get<T>(key: string): Promise<T | undefined> {
      return storeState.get(key) as T | undefined
    }
    async set<T>(key: string, value: T): Promise<void> {
      if (storeState.get("throwOnSet") === key) throw new Error("set failed")
      storeState.set(key, value)
    }
    async save(): Promise<void> {}
  },
}))

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}))

import { CodexScopedProviderCard, filterCodexLinesByAccount } from "@/components/codex-account-scope"
import { OverviewPage } from "@/pages/overview"
import type { MetricLine } from "@/lib/plugin-types"

const lines: MetricLine[] = [
  { type: "text", label: "Work · Session", value: "22% left" },
  { type: "text", label: "Personal · Session", value: "82% left" },
  { type: "text", label: "Usage Trend", value: "steady" },
]

const twoAccounts = {
  accounts: [
    { label: "Personal", home: "/Users/keshav/.codex", source: "default", hasAuth: true },
    { label: "Work", home: "/Users/keshav/.codex-work", source: "detected", hasAuth: true },
  ],
  profileNote: null,
}

function renderCard() {
  return render(
    <CodexScopedProviderCard id="codex" name="Codex" iconUrl="icon" displayMode="left" lines={lines} />
  )
}

describe("CodexScopedProviderCard", () => {
  beforeEach(() => {
    storeState.clear()
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(twoAccounts)
  })

  it("shows the switch with two accounts and filters lines by account", async () => {
    renderCard()
    const group = await screen.findByRole("group", { name: "Codex Account" })
    expect(group).toBeInTheDocument()
    expect(screen.getByText("Work · Session")).toBeInTheDocument()
    expect(screen.getByText("Personal · Session")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Work" }))
    expect(screen.getByText("Work · Session")).toBeInTheDocument()
    expect(screen.queryByText("Personal · Session")).not.toBeInTheDocument()
    expect(screen.getByText("Usage Trend")).toBeInTheDocument()
    expect(storeState.get("codexAccountView")).toBe("Work")
    expect(screen.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true")

    await userEvent.click(screen.getByRole("button", { name: "Both" }))
    expect(screen.getByText("Personal · Session")).toBeInTheDocument()
    expect(storeState.get("codexAccountView")).toBe("both")
    // Long labels truncate inside the card and keep the full name on hover.
    const work = screen.getByRole("button", { name: "Work" })
    expect(work).toHaveAttribute("title", "Work")
    expect(work.className).toContain("truncate")
  })

  it("falls back to Both when the saved view no longer exists", async () => {
    storeState.set("codexAccountView", "Gone")
    renderCard()
    await screen.findByRole("group", { name: "Codex Account" })
    expect(screen.getByText("Work · Session")).toBeInTheDocument()
    expect(screen.getByText("Personal · Session")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Both" })).toHaveAttribute("aria-pressed", "true")
  })

  it("hides the switch when fewer than two accounts exist", async () => {
    invokeMock.mockResolvedValue({ accounts: [twoAccounts.accounts[0]], profileNote: null })
    renderCard()
    expect(await screen.findByText("Personal · Session")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Codex Account" })).not.toBeInTheDocument()
  })

  it("keeps all lines and logs when accounts cannot be loaded", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    invokeMock.mockRejectedValue(new Error("sync failed"))
    render(
      <CodexScopedProviderCard id="codex" name="Codex" iconUrl="icon" displayMode="left" />
    )
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load Codex accounts:", expect.any(Error))
    })
    expect(screen.queryByRole("group", { name: "Codex Account" })).not.toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it("logs when the view cannot be saved", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    storeState.set("throwOnSet", "codexAccountView")
    renderCard()
    await screen.findByRole("group", { name: "Codex Account" })
    await userEvent.click(screen.getByRole("button", { name: "Work" }))
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save Codex account view:",
        expect.any(Error)
      )
    })
    expect(screen.queryByText("Personal · Session")).not.toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it("ignores a load that finishes after unmount", async () => {
    let resolveSync: (value: unknown) => void = () => {}
    invokeMock.mockReturnValue(new Promise((resolve) => {
      resolveSync = resolve
    }))
    const { unmount } = renderCard()
    unmount()
    await act(async () => {
      resolveSync(twoAccounts)
      await Promise.resolve()
    })
    expect(screen.queryByRole("group", { name: "Codex Account" })).not.toBeInTheDocument()
  })

  it("renders the Codex overview row with the account switch", async () => {
    const plugins = [
      {
        meta: { id: "codex", name: "Codex", iconUrl: "icon", lines: [] },
        data: {
          providerId: "codex",
          displayName: "Codex",
          plan: "Work Plus · Personal Pro",
          lines,
          iconUrl: "icon",
        },
        loading: false,
        error: null,
        lastManualRefreshAt: null,
        lastUpdatedAt: null,
      },
    ]
    render(
      <OverviewPage plugins={plugins} displayMode="left" resetTimerDisplayMode="relative" />
    )
    expect(await screen.findByRole("group", { name: "Codex Account" })).toBeInTheDocument()
    expect(screen.getByText("Work Plus · Personal Pro")).toBeInTheDocument()
  })
})

describe("filterCodexLinesByAccount", () => {
  it("returns every line for the Both view", () => {
    expect(filterCodexLinesByAccount(lines, ["Work", "Personal"], "both")).toEqual(lines)
  })

  it("keeps unowned lines when filtering by account", () => {
    const filtered = filterCodexLinesByAccount(lines, ["Work", "Personal"], "Work")
    expect(filtered.map((line) => line.label)).toEqual(["Work · Session", "Usage Trend"])
  })
})
