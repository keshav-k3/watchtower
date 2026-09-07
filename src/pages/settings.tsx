import { GlobalShortcutSection } from "@/components/global-shortcut-section"
import { ProviderHomesSection } from "@/components/provider-homes-section"
import type { HomeCapablePluginId, ProviderHome } from "@/lib/provider-homes"
import type { GlobalShortcut } from "@/lib/settings"

type SettingsPageProps = {
  globalShortcut: GlobalShortcut
  onGlobalShortcutChange: (value: GlobalShortcut) => void
  providerHomes: ProviderHome[]
  onAddProviderHome: (draft: { pluginId: HomeCapablePluginId; name: string; homePath: string }) => void
  onRemoveProviderHome: (id: string) => void
}

export function SettingsPage({
  globalShortcut,
  onGlobalShortcutChange,
  providerHomes,
  onAddProviderHome,
  onRemoveProviderHome,
}: SettingsPageProps) {
  return (
    <div className="space-y-6 py-1">
      <GlobalShortcutSection
        globalShortcut={globalShortcut}
        onGlobalShortcutChange={onGlobalShortcutChange}
      />
      <ProviderHomesSection
        homes={providerHomes}
        onAdd={onAddProviderHome}
        onRemove={onRemoveProviderHome}
      />
    </div>
  )
}
