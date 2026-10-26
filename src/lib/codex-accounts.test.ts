import { beforeEach, describe, expect, it, vi } from "vitest"
import { codexAccountError, syncCodexAccounts } from "@/lib/codex-accounts"

const { invokeMock, loadCodexAccountSettingsMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  loadCodexAccountSettingsMock: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}))

vi.mock("@/lib/settings", () => ({
  loadCodexAccountSettings: loadCodexAccountSettingsMock,
}))

describe("codex accounts", () => {
  beforeEach(() => {
    invokeMock.mockReset()
    loadCodexAccountSettingsMock.mockReset()
    loadCodexAccountSettingsMock.mockResolvedValue({
      showAll: true,
      accounts: [{ label: "Work", home: "/tmp/work" }],
    })
  })

  it("asks for a label and a home folder", () => {
    expect(codexAccountError("  ", "/tmp/codex")).toBe("Enter a label.")
    expect(codexAccountError("Work", "  ")).toBe("Enter the Codex home folder.")
    expect(codexAccountError("Work", "/tmp/codex")).toBeNull()
  })

  it("syncs the saved accounts and keeps an empty response usable", async () => {
    invokeMock.mockResolvedValueOnce({
      accounts: [{ label: "Work", home: "/tmp/work", source: "manual", hasAuth: true }],
      profileNote: "Profiles share one login.",
    })
    await expect(syncCodexAccounts()).resolves.toEqual({
      accounts: [{ label: "Work", home: "/tmp/work", source: "manual", hasAuth: true }],
      profileNote: "Profiles share one login.",
    })
    expect(invokeMock).toHaveBeenCalledWith("sync_codex_accounts", {
      showAll: true,
      accounts: [{ label: "Work", home: "/tmp/work" }],
    })

    invokeMock.mockResolvedValueOnce(null)
    await expect(syncCodexAccounts()).resolves.toEqual({ accounts: [], profileNote: null })
  })
})
