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
    <div className="absolute right-0 top-10 z-30 w-[214px] rounded-xl border border-white/[0.09] bg-[#202020] p-2 shadow-2xl shadow-black/40 ring-1 ring-black/20">
      <div className="px-2 pb-1.5 pt-1">
        <div className="text-[13px] font-semibold leading-5 text-foreground">Providers</div>
        <div className="text-[11px] leading-4 text-muted-foreground">Toggle Visibility</div>
      </div>
      <div className="space-y-1">
        {providers.map((provider) => {
          const isEnabled = !disabled.has(provider.id)
          return (
            <button
              key={provider.id}
              type="button"
              className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-white/[0.05]"
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
                    ? "border-white/20 bg-[#e5e5e5]"
                    : "border-white/[0.08] bg-white/[0.06]"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full transition-transform",
                    isEnabled
                      ? "translate-x-[13px] bg-[#1c1c1c]"
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
