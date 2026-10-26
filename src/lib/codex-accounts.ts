import { invoke } from "@tauri-apps/api/core"
import { loadCodexAccountSettings, type CodexAccountRecord } from "@/lib/settings"

export type ResolvedCodexAccount = CodexAccountRecord & {
  source: string
  hasAuth: boolean
}

export type CodexAccountSync = {
  accounts: ResolvedCodexAccount[]
  profileNote: string | null
}

export function codexAccountError(label: string, home: string): string | null {
  if (!label.trim()) return "Enter a label."
  if (!home.trim()) return "Enter the Codex home folder."
  return null
}

export async function syncCodexAccounts(): Promise<CodexAccountSync> {
  const settings = await loadCodexAccountSettings()
  const result = await invoke<CodexAccountSync | null>("sync_codex_accounts", {
    showAll: settings.showAll,
    accounts: settings.accounts,
  })
  return {
    accounts: result?.accounts ?? [],
    profileNote: result?.profileNote ?? null,
  }
}
