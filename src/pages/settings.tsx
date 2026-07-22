import { GlobalShortcutSection } from "@/components/global-shortcut-section"
import type { GlobalShortcut } from "@/lib/settings"

type SettingsPageProps = {
  globalShortcut: GlobalShortcut
  onGlobalShortcutChange: (value: GlobalShortcut) => void
}

export function SettingsPage({
  globalShortcut,
  onGlobalShortcutChange,
}: SettingsPageProps) {
  return (
    <div className="space-y-4 py-1">
      <GlobalShortcutSection
        globalShortcut={globalShortcut}
        onGlobalShortcutChange={onGlobalShortcutChange}
      />
    </div>
  )
}
