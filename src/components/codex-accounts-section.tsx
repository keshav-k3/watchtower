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
import { Switch } from "@/components/ui/switch"

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
    <div>
      <h2 className="px-1 pb-1 text-[13px] font-semibold text-foreground">Codex Accounts</h2>
      <p className="px-1 pb-2 text-[11px] leading-4 text-muted-foreground">
        A second login needs its own Codex home folder. Config profiles share one login.
      </p>

      <div className="divide-y divide-line border-t border-line">
        <div className="flex items-center justify-between gap-2 py-2 pl-1">
          <span className="text-[13px] text-foreground">Reset Alerts</span>
          <Switch
            aria-label="Reset Alerts"
            checked={resetNotifications}
            onCheckedChange={(next) => {
              setResetNotifications(next)
              void saveCodexResetNotifications(next).catch((error) => {
                console.error("Failed to save Codex reset notifications:", error)
              })
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 py-2 pl-1">
          <span className="text-[13px] text-foreground">Show All Accounts</span>
          <Switch
            aria-label="Show All Accounts"
            checked={showAll}
            onCheckedChange={(next) => {
              void persist(next, accounts)
            }}
          />
        </div>
      </div>

      {profileNote && <p className="px-1 pt-2 text-[11px] text-muted-foreground">{profileNote}</p>}
      {syncError && <p className="px-1 pt-2 text-[11px] text-destructive">{syncError}</p>}

      {resolved.length > 0 && (
        <ul className="mt-1 divide-y divide-line border-t border-line">
          {resolved.map((account) => (
            <li key={account.home} className="py-2 pl-1">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words text-[13px] font-medium text-foreground">
                  {account.label}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="label-mono text-[10px] uppercase text-muted-foreground">
                    {account.source}
                  </span>
                  {accounts.some((item) => item.home === account.home) && (
                    <button
                      type="button"
                      className="text-[12px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                      onClick={() => {
                        void persist(
                          showAll,
                          accounts.filter((item) => item.home !== account.home)
                        )
                      }}
                    >
                      Remove
                    </button>
                  )}
                </span>
              </div>
              <p className="break-all text-[11px] leading-4 text-muted-foreground" title={account.home}>
                {account.home}
              </p>
              {!account.hasAuth && (
                <p className="text-[11px] text-destructive">No auth.json in this folder.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-2 space-y-2 border-t border-line pt-3"
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
        <label className="block px-1 text-[11px] text-muted-foreground">
          Label
          <input
            aria-label="Codex account label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Work"
            className="mt-0.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-[13px] text-foreground"
          />
        </label>
        <label className="block px-1 text-[11px] text-muted-foreground">
          Home Folder
          <input
            aria-label="Codex home folder"
            value={home}
            onChange={(event) => setHome(event.target.value)}
            placeholder="/Users/you/.codex-work"
            className="mt-0.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-[13px] text-foreground"
          />
        </label>
        {formError && <p className="px-1 text-[11px] text-destructive">{formError}</p>}
        <div className="px-1">
          <button
            type="submit"
            className="text-[12px] font-medium text-foreground underline-offset-2 hover:underline"
          >
            Add Account
          </button>
        </div>
      </form>
    </div>
  )
}
