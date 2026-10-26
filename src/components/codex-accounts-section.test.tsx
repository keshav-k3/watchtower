import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

const storeState = new Map<string, unknown>()

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    async get<T>(key: string): Promise<T | undefined> {
      if (storeState.get("hangGet")) {
        await new Promise<void>((resolve) => {
          storeState.set("releaseGet", resolve)
        })
      }
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

import { CodexAccountsSection } from "@/components/codex-accounts-section"

describe("CodexAccountsSection", () => {
  beforeEach(() => {
    storeState.clear()
    invokeMock.mockReset()
    useAppPreferencesStore.getState().resetState()
    invokeMock.mockImplementation(async (_cmd: string, args: { showAll: boolean; accounts: { label: string; home: string }[] }) => ({
      accounts: [
        { label: "Codex", home: "/tmp/codex", source: "default", hasAuth: true },
        ...args.accounts.map((account) => ({
          label: account.label,
          home: account.home,
          source: "manual",
          hasAuth: false,
        })),
      ],
      profileNote: args.showAll ? "Codex config profiles share one login." : null,
    }))
  })

  it("adds and removes an account and toggles both switches", async () => {
    render(<CodexAccountsSection />)
    expect(await screen.findByText("/tmp/codex")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove Codex" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Add Account" }))
    expect(screen.getByText("Enter a label.")).toBeInTheDocument()

    await userEvent.type(screen.getByRole("textbox", { name: "Codex account label" }), "Work")
    await userEvent.click(screen.getByRole("button", { name: "Add Account" }))
    expect(screen.getByText("Enter the Codex home folder.")).toBeInTheDocument()

    await userEvent.type(screen.getByRole("textbox", { name: "Codex home folder" }), "/tmp/work")
    await userEvent.click(screen.getByRole("button", { name: "Add Account" }))
    expect(await screen.findByText("No auth.json in this folder.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Show All Accounts: Off" }))
    expect(await screen.findByText("Codex config profiles share one login.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Reset Alerts: On" }))
    expect(screen.getByRole("button", { name: "Reset Alerts: Off" })).toBeInTheDocument()
    expect(useAppPreferencesStore.getState().codexResetNotifications).toBe(false)

    await userEvent.click(screen.getByRole("button", { name: "Remove Work" }))
    expect(await screen.findByText("/tmp/codex")).toBeInTheDocument()
    expect(screen.queryByText("/tmp/work")).not.toBeInTheDocument()
  })

  it("shows a load error, a save error, and a reset-alert save error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    invokeMock.mockRejectedValueOnce(new Error("sync"))
    const first = render(<CodexAccountsSection />)
    expect(await screen.findByText("Codex accounts could not be loaded.")).toBeInTheDocument()
    first.unmount()

    let failSave = false
    invokeMock.mockImplementation(async (_cmd: string, args: { showAll: boolean; accounts: { label: string; home: string }[] }) => {
      if (failSave) throw new Error("save")
      return {
        accounts: [
          { label: "Codex", home: "/tmp/codex", source: "default", hasAuth: true },
          ...args.accounts.map((account) => ({ ...account, source: "manual", hasAuth: false })),
        ],
        profileNote: null,
      }
    })
    render(<CodexAccountsSection />)
    expect(await screen.findByText("/tmp/codex")).toBeInTheDocument()
    failSave = true
    await userEvent.click(screen.getByRole("button", { name: "Show All Accounts: Off" }))
    expect(await screen.findByText("Codex accounts could not be saved.")).toBeInTheDocument()

    storeState.set("throwOnSet", "codexResetNotifications")
    await userEvent.click(screen.getByRole("button", { name: "Reset Alerts: On" }))
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save Codex reset notifications:",
        expect.any(Error),
      )
    })
    consoleSpy.mockRestore()
  })

  it("ignores a settings load that finishes after close", async () => {
    storeState.set("hangGet", true)
    const { unmount } = render(<CodexAccountsSection />)
    await act(async () => {
      await Promise.resolve()
    })
    unmount()
    const release = storeState.get("releaseGet") as (() => void) | undefined
    await act(async () => {
      release?.()
      await Promise.resolve()
    })
    expect(screen.queryByText("/tmp/codex")).not.toBeInTheDocument()
  })

  it("ignores a failed sync that finishes after close", async () => {
    let rejectSync: (error: Error) => void = () => {}
    invokeMock.mockReturnValue(new Promise((_resolve, reject) => {
      rejectSync = reject
    }))
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { unmount } = render(<CodexAccountsSection />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    unmount()
    await act(async () => {
      rejectSync(new Error("late"))
      await Promise.resolve()
    })
    expect(screen.queryByText("Codex accounts could not be loaded.")).not.toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it("does not apply a load that finishes after the section closes", async () => {
    let resolveSync: (value: unknown) => void = () => {}
    invokeMock.mockReturnValue(new Promise((resolve) => {
      resolveSync = resolve
    }))
    const { unmount } = render(<CodexAccountsSection />)
    await act(async () => {
      await Promise.resolve()
    })
    unmount()
    resolveSync({ accounts: [], profileNote: null })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByText("/tmp/codex")).not.toBeInTheDocument()
  })
})
