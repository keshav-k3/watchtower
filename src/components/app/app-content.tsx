import { useShallow } from "zustand/react/shallow"
import { OverviewPage } from "@/pages/overview"
import { ProviderDetailPage } from "@/pages/provider-detail"
import { PortsPage } from "@/pages/ports"
import { SettingsPage } from "@/pages/settings"
import type { DisplayPluginState } from "@/hooks/app/use-app-plugin-views"
import type { PluginMeta } from "@/lib/plugin-types"
import type { GlobalShortcut, PluginSettings } from "@/lib/settings"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import { useAppUiStore } from "@/stores/app-ui-store"

type AppContentDerivedProps = {
  displayPlugins: DisplayPluginState[]
  selectedPlugin: DisplayPluginState | null
}

export type AppContentActionProps = {
  onRetryPlugin: (id: string) => void
  onResetTimerDisplayModeToggle: () => void
  onGlobalShortcutChange: (value: GlobalShortcut) => void
  pluginsMeta?: PluginMeta[]
  pluginSettings?: PluginSettings | null
  onProviderToggle?: (id: string) => void
}

export type AppContentProps = AppContentDerivedProps & AppContentActionProps

export function AppContent({
  displayPlugins,
  selectedPlugin,
  onRetryPlugin,
  onResetTimerDisplayModeToggle,
  onGlobalShortcutChange,
  pluginsMeta = [],
  pluginSettings = null,
  onProviderToggle = () => {},
}: AppContentProps) {
  const { activeView, setActiveView } = useAppUiStore(
    useShallow((state) => ({
      activeView: state.activeView,
      setActiveView: state.setActiveView,
    }))
  )

  const {
    displayMode,
    resetTimerDisplayMode,
    timeFormatMode,
    globalShortcut,
  } = useAppPreferencesStore(
    useShallow((state) => ({
      displayMode: state.displayMode,
      resetTimerDisplayMode: state.resetTimerDisplayMode,
      timeFormatMode: state.timeFormatMode,
      globalShortcut: state.globalShortcut,
    }))
  )

  if (activeView === "home") {
    return (
      <OverviewPage
        plugins={displayPlugins}
        onRetryPlugin={onRetryPlugin}
        displayMode={displayMode}
        resetTimerDisplayMode={resetTimerDisplayMode}
        timeFormatMode={timeFormatMode}
        onResetTimerDisplayModeToggle={onResetTimerDisplayModeToggle}
        onChooseProviders={() => setActiveView("settings")}
      />
    )
  }

  if (activeView === "ports") {
    return <PortsPage />
  }

  if (activeView === "settings") {
    return (
      <SettingsPage
        globalShortcut={globalShortcut}
        onGlobalShortcutChange={onGlobalShortcutChange}
        pluginsMeta={pluginsMeta}
        pluginSettings={pluginSettings}
        onProviderToggle={onProviderToggle}
      />
    )
  }

  const handleRetry = selectedPlugin
    ? () => onRetryPlugin(selectedPlugin.meta.id)
    : /* v8 ignore next */ undefined

  return (
    <ProviderDetailPage
      plugin={selectedPlugin}
      onRetry={handleRetry}
      displayMode={displayMode}
      resetTimerDisplayMode={resetTimerDisplayMode}
      timeFormatMode={timeFormatMode}
      onResetTimerDisplayModeToggle={onResetTimerDisplayModeToggle}
    />
  )
}
