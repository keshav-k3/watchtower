import { CodexAccountsSection } from "@/components/codex-accounts-section"
import { GlobalShortcutSection } from "@/components/global-shortcut-section"
import { ProviderSettingsPopover } from "@/components/provider-settings-popover"
import type { PluginMeta } from "@/lib/plugin-types"
import type { GlobalShortcut, PluginSettings } from "@/lib/settings"

type SettingsPageProps = {
  globalShortcut: GlobalShortcut
  onGlobalShortcutChange: (value: GlobalShortcut) => void
  pluginsMeta?: PluginMeta[]
  pluginSettings?: PluginSettings | null
  onProviderToggle?: (id: string) => void
}

export function SettingsPage({
  globalShortcut,
  onGlobalShortcutChange,
  pluginsMeta = [],
  pluginSettings = null,
  onProviderToggle = () => {},
}: SettingsPageProps) {
  return (
    <div className="px-4 py-2">
      <section className="border-b border-line py-2">
        <h2 className="px-1 pb-1 text-[13px] font-semibold text-foreground">Providers</h2>
        <ProviderSettingsPopover
          pluginsMeta={pluginsMeta}
          pluginSettings={pluginSettings}
          onProviderToggle={onProviderToggle}
        />
      </section>
      <section className="py-3">
        <h2 className="px-1 pb-2 text-[13px] font-semibold text-foreground">Shortcut</h2>
        <GlobalShortcutSection
          globalShortcut={globalShortcut}
          onGlobalShortcutChange={onGlobalShortcutChange}
        />
      </section>
      <section className="border-t border-line py-3">
        <CodexAccountsSection />
      </section>
    </div>
  )
}
