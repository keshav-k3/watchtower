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
    <div className="absolute right-4 top-14 z-30 max-h-[calc(100%-4rem)] w-[214px] overflow-y-auto rounded-[12px] border border-line-bright bg-surface-raised p-2 shadow-2xl shadow-black/50 scrollbar-none">
      <div className="px-2 pb-1.5 pt-1">
        <div className="text-[13px] font-semibold leading-5 text-foreground">Providers</div>
        <div className="label-mono text-[9px] leading-4 text-muted-foreground/70">Toggle Visibility</div>
      </div>
      <div className="space-y-1">
        {providers.map((provider) => {
          const isEnabled = !disabled.has(provider.id)
          return (
            <button
              key={provider.id}
              type="button"
              className="flex h-10 w-full items-center gap-2.5 rounded-[8px] px-2 text-left transition-colors hover:bg-surface"
              onClick={() => onProviderToggle(provider.id)}
            >
              <ProviderIcon
                id={provider.id}
                name={provider.name}
                iconUrl={provider.iconUrl}
                brandColor={provider.brandColor}
                active={isEnabled}
                className="size-5"
              />
              <span className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold", isEnabled ? "text-foreground" : "text-muted-foreground")}>
                {provider.name}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "relative h-4 w-7 rounded-full border transition-colors",
                  isEnabled
                    ? "border-transparent bg-[var(--display)]"
                    : "border-line-bright bg-surface"
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
          )
        })}
      </div>
    </div>
  )
}
