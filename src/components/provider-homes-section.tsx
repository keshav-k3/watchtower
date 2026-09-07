import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons-pro/core-solid-rounded"
import { Button } from "@/components/ui/button"
import {
  HOME_CAPABLE_PLUGIN_IDS,
  type HomeCapablePluginId,
  type ProviderHome,
} from "@/lib/provider-homes"
import { cn } from "@/lib/utils"

const PROVIDER_LABELS: Record<HomeCapablePluginId, string> = {
  claude: "Claude",
  codex: "Codex",
}

type ProviderHomesSectionProps = {
  homes: ProviderHome[]
  onAdd: (draft: { pluginId: HomeCapablePluginId; name: string; homePath: string }) => void
  onRemove: (id: string) => void
}

export function ProviderHomesSection({
  homes,
  onAdd,
  onRemove,
}: ProviderHomesSectionProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [pluginId, setPluginId] = useState<HomeCapablePluginId>("claude")
  const [name, setName] = useState("Claude Work")
  const [homePath, setHomePath] = useState("~/.claude-work")
  const [error, setError] = useState<string | null>(null)

  const resetForm = (nextPluginId: HomeCapablePluginId = "claude") => {
    setPluginId(nextPluginId)
    setName(nextPluginId === "claude" ? "Claude Work" : "Codex Work")
    setHomePath(nextPluginId === "claude" ? "~/.claude-work" : "~/.codex-work")
    setError(null)
  }

  const handleProviderChange = (nextPluginId: HomeCapablePluginId) => {
    setPluginId(nextPluginId)
    setName(nextPluginId === "claude" ? "Claude Work" : "Codex Work")
    setHomePath(nextPluginId === "claude" ? "~/.claude-work" : "~/.codex-work")
  }

  const handleAdd = () => {
    const trimmedName = name.trim()
    const trimmedPath = homePath.trim()
    if (!trimmedName) {
      setError("Enter a name for this account.")
      return
    }
    if (!trimmedPath) {
      setError("Enter the config folder this account uses.")
      return
    }
    onAdd({ pluginId, name: trimmedName, homePath: trimmedPath })
    setIsAdding(false)
    resetForm()
  }

  return (
    <section>
      <h3 className="text-lg font-semibold mb-0">Extra Accounts</h3>
      <p className="text-sm text-muted-foreground mb-2">
        Track another Claude or Codex login from a separate config folder. Use this for personal and work aliases such as p-claude and w-claude.
      </p>
      <div className="space-y-2">
        {homes.length === 0 && !isAdding ? (
          <p className="text-sm text-muted-foreground">No extra accounts yet.</p>
        ) : null}
        {homes.map((home) => (
          <div
            key={home.id}
            className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{home.name}</div>
              <div className="label-mono truncate text-[10px] text-muted-foreground">
                {PROVIDER_LABELS[home.pluginId]} · {home.homePath}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(home.id)}
              className="p-0.5 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Remove ${home.name}`}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </button>
          </div>
        ))}
        {isAdding ? (
          <div className="space-y-2 rounded-md border bg-muted/50 p-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium">Provider</span>
              <select
                value={pluginId}
                onChange={(event) => handleProviderChange(event.target.value as HomeCapablePluginId)}
                className={cn(
                  "h-8 w-full rounded-md border bg-background px-2 text-sm outline-none",
                  "focus-visible:border-primary"
                )}
                aria-label="Provider"
              >
                {HOME_CAPABLE_PLUGIN_IDS.map((id) => (
                  <option key={id} value={id}>
                    {PROVIDER_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-primary"
                aria-label="Name"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Config Folder</span>
              <input
                value={homePath}
                onChange={(event) => setHomePath(event.target.value)}
                className="h-8 w-full rounded-md border bg-background px-2 font-mono text-sm outline-none focus-visible:border-primary"
                aria-label="Config Folder"
                placeholder="~/.claude-work"
              />
            </label>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleAdd}>
                Add Account
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            Add Account
          </Button>
        )}
      </div>
    </section>
  )
}
