import { ProviderIcon } from "@/components/provider-icon"
import type { PluginMeta } from "@/lib/plugin-types"
import type { PluginSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"

type ProviderSettingsPopoverProps = {
  pluginsMeta: PluginMeta[]
  pluginSettings: PluginSettings | null
  onProviderToggle: (id: string) => void
}

export function ProviderSettingsPopover({
  pluginsMeta,
  pluginSettings,
  onProviderToggle,
}: ProviderSettingsPopoverProps) {
  if (!pluginSettings) return null

  const metaById = new Map(pluginsMeta.map((plugin) => [plugin.id, plugin]))
  const disabled = new Set(pluginSettings.disabled)
  const providers = pluginSettings.order
    .map((id) => metaById.get(id))
    .filter((plugin): plugin is PluginMeta => Boolean(plugin))

  return (
    <div className="max-h-[calc(100%-4rem)] overflow-y-auto scrollbar-none">
      <ul className="py-1">
        {providers.map((provider) => {
          const isEnabled = !disabled.has(provider.id)
          return (
            <li key={provider.id}>
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                className="flex min-h-9 w-full items-center gap-2 rounded-md px-1 text-left hover:bg-muted"
                onClick={() => onProviderToggle(provider.id)}
              >
                <ProviderIcon
                  id={provider.id}
                  name={provider.name}
                  iconUrl={provider.iconUrl}
                  brandColor={provider.brandColor}
                  active={isEnabled}
                  className="size-4"
                />
                <span className={cn("min-w-0 flex-1 break-words text-[13px]", isEnabled ? "text-foreground" : "text-muted-foreground")}>
                  {provider.name}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative h-4 w-7 shrink-0 rounded-full border transition-colors",
                    isEnabled
                      ? "border-transparent bg-foreground"
                      : "border-line bg-surface"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full transition-transform",
                      isEnabled
                        ? "translate-x-[13px] bg-background"
                        : "translate-x-0.5 bg-muted-foreground"
                    )}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
