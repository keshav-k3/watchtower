import { useEffect, useState } from "react"
import {
  loadCodexAccountSettings,
  saveCodexAccountSettings,
  saveCodexResetNotifications,
  type CodexAccountRecord,
} from "@/lib/settings"
import {
  codexAccountError,
  syncCodexAccounts,
  type ResolvedCodexAccount,
} from "@/lib/codex-accounts"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

export function CodexAccountsSection() {
  const resetNotifications = useAppPreferencesStore((state) => state.codexResetNotifications)
  const setResetNotifications = useAppPreferencesStore((state) => state.setCodexResetNotifications)
  const [showAll, setShowAll] = useState(false)
  const [accounts, setAccounts] = useState<CodexAccountRecord[]>([])
  const [resolved, setResolved] = useState<ResolvedCodexAccount[]>([])
  const [profileNote, setProfileNote] = useState<string | null>(null)
  const [label, setLabel] = useState("")
  const [home, setHome] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const stored = await loadCodexAccountSettings()
        if (cancelled) return
        setShowAll(stored.showAll)
        setAccounts(stored.accounts)
        const sync = await syncCodexAccounts()
        if (cancelled) return
        setResolved(sync.accounts)
        setProfileNote(sync.profileNote)
      } catch (error) {
        console.error("Failed to load Codex accounts:", error)
        if (!cancelled) setSyncError("Codex accounts could not be loaded.")
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = async (nextShowAll: boolean, nextAccounts: CodexAccountRecord[]) => {
    setShowAll(nextShowAll)
    setAccounts(nextAccounts)
    try {
      await saveCodexAccountSettings({ showAll: nextShowAll, accounts: nextAccounts })
      const sync = await syncCodexAccounts()
      setResolved(sync.accounts)
      setProfileNote(sync.profileNote)
      setSyncError(null)
    } catch (error) {
      console.error("Failed to save Codex accounts:", error)
      setSyncError("Codex accounts could not be saved.")
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold mb-0">Codex Accounts</h3>
        <p className="text-sm text-muted-foreground">
          A second login needs its own Codex home folder. Config profiles share one login.
        </p>
      </div>

      <button
        type="button"
        aria-pressed={resetNotifications}
        className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-left text-sm"
        onClick={() => {
          const next = !resetNotifications
          setResetNotifications(next)
          void saveCodexResetNotifications(next).catch((error) => {
            console.error("Failed to save Codex reset notifications:", error)
          })
        }}
      >
        Reset Alerts: {resetNotifications ? "On" : "Off"}
      </button>

      <button
        type="button"
        aria-pressed={showAll}
        className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-left text-sm"
        onClick={() => {
          void persist(!showAll, accounts)
        }}
      >
        Show All Accounts: {showAll ? "On" : "Off"}
      </button>

      {profileNote && <p className="text-xs text-muted-foreground">{profileNote}</p>}
      {syncError && <p className="text-xs text-destructive">{syncError}</p>}

      <ul className="space-y-2">
        {resolved.map((account) => (
          <li key={account.home} className="rounded-[10px] border border-line px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{account.label}</span>
              <span className="label-mono text-[10px] text-muted-foreground">{account.source}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{account.home}</p>
            {!account.hasAuth && (
              <p className="text-xs text-destructive">No auth.json in this folder.</p>
            )}
            {accounts.some((item) => item.home === account.home) && (
              <button
                type="button"
                className="mt-1 text-xs text-muted-foreground"
                onClick={() => {
                  void persist(showAll, accounts.filter((item) => item.home !== account.home))
                }}
              >
                Remove {account.label}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          const error = codexAccountError(label, home)
          if (error) {
            setFormError(error)
            return
          }
          setFormError(null)
          setLabel("")
          setHome("")
          void persist(showAll, [...accounts, { label: label.trim(), home: home.trim() }])
        }}
      >
        <label className="block text-xs text-muted-foreground">
          Label
          <input
            aria-label="Codex account label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="mt-1 w-full rounded-[8px] border border-line bg-surface px-2 py-1 text-sm text-foreground"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Home Folder
          <input
            aria-label="Codex home folder"
            value={home}
            onChange={(event) => setHome(event.target.value)}
            className="mt-1 w-full rounded-[8px] border border-line bg-surface px-2 py-1 text-sm text-foreground"
          />
        </label>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <button type="submit" className="rounded-[8px] border border-line px-2 py-1 text-sm">
          Add Account
        </button>
      </form>
    </section>
  )
}
