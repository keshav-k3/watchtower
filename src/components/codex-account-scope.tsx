import { useEffect, useState, type ComponentProps } from "react"
import { ProviderCard } from "@/components/provider-card"
import { syncCodexAccounts } from "@/lib/codex-accounts"
import {
  DEFAULT_CODEX_ACCOUNT_VIEW,
  loadCodexAccountView,
  saveCodexAccountView,
} from "@/lib/settings"
import type { MetricLine } from "@/lib/plugin-types"
import { cn } from "@/lib/utils"

const ACCOUNT_SEPARATOR = " · "

export function filterCodexLinesByAccount(
  lines: MetricLine[],
  accountLabels: string[],
  view: string
): MetricLine[] {
  if (view === DEFAULT_CODEX_ACCOUNT_VIEW) return lines
  return lines.filter((line) => {
    const owner = accountLabels.find((label) => line.label.startsWith(label + ACCOUNT_SEPARATOR))
    return !owner || owner === view
  })
}

type CodexScopedProviderCardProps = ComponentProps<typeof ProviderCard>

export function CodexScopedProviderCard({ lines = [], ...props }: CodexScopedProviderCardProps) {
  const [accountLabels, setAccountLabels] = useState<string[]>([])
  const [view, setView] = useState<string>(DEFAULT_CODEX_ACCOUNT_VIEW)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [sync, storedView] = await Promise.all([syncCodexAccounts(), loadCodexAccountView()])
        if (cancelled) return
        const labels = [
          ...new Set(sync.accounts.map((account) => account.label).filter((label) => label.trim())),
        ]
        setAccountLabels(labels)
        setView(storedView)
      } catch (error) {
        console.error("Failed to load Codex accounts:", error)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const activeView = accountLabels.includes(view) ? view : DEFAULT_CODEX_ACCOUNT_VIEW
  const filteredLines = filterCodexLinesByAccount(lines, accountLabels, activeView)

  const selectView = (next: string) => {
    setView(next)
    void saveCodexAccountView(next).catch((error) => {
      console.error("Failed to save Codex account view:", error)
    })
  }

  const accessory =
    accountLabels.length >= 2 ? (
      <div className="mb-1.5 flex justify-end">
        <div
          role="group"
          aria-label="Codex Account"
          className="inline-flex items-center rounded-full border border-line bg-surface p-0.5"
        >
          {["Both", ...accountLabels].map((option) => {
            const value = option === "Both" ? DEFAULT_CODEX_ACCOUNT_VIEW : option
            const active = activeView === value
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => selectView(value)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] leading-4 transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    ) : undefined

  return <ProviderCard {...props} lines={filteredLines} accessory={accessory} />
}
