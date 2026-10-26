import { invoke } from "@tauri-apps/api/core"
import { loadCodexAccountSettings, type CodexAccountRecord } from "@/lib/settings"

export type ResolvedCodexAccount = CodexAccountRecord & {
  source: string
  hasAuth: boolean
  /** The folder as typed in Settings, before `~` and `$HOME` were expanded. */
  inputHome?: string
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

/** True when a saved manual entry produced this resolved account. */
export function isSavedAccount(record: CodexAccountRecord, account: ResolvedCodexAccount): boolean {
  return record.home === (account.inputHome ?? account.home)
}
