import { useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon, Settings02Icon } from "@hugeicons-pro/core-solid-rounded"
import { AppContent, type AppContentActionProps } from "@/components/app/app-content"
import { Button } from "@/components/ui/button"
import { PanelFooter } from "@/components/panel-footer"
import { ProviderSettingsPopover } from "@/components/provider-settings-popover"
import { SideNav, type NavPlugin, type PluginContextAction } from "@/components/side-nav"
import { ThemeToggleButton } from "@/components/theme-toggle-button"
import type { DisplayPluginState } from "@/hooks/app/use-app-plugin-views"
import type { PluginMeta } from "@/lib/plugin-types"
import type { PluginSettings, ThemeMode } from "@/lib/settings"
import { useAppVersion } from "@/hooks/app/use-app-version"
import { usePanel } from "@/hooks/app/use-panel"
import { useAppUpdate } from "@/hooks/use-app-update"
import { useAppUiStore } from "@/stores/app-ui-store"

const ARROW_OVERHEAD_PX = 37

type AppShellProps = {
  onRefreshAll: () => void
  navPlugins: NavPlugin[]
  pluginsMeta: PluginMeta[]
  pluginSettings: PluginSettings | null
  displayPlugins: DisplayPluginState[]
  autoUpdateNextAt: number | null
  selectedPlugin: DisplayPluginState | null
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
  onPluginContextAction: (pluginId: string, action: PluginContextAction) => void
  isPluginRefreshAvailable: (pluginId: string) => boolean
  onNavReorder: (orderedIds: string[]) => void
  onProviderToggle: (pluginId: string) => void
  appContentProps: AppContentActionProps
}

export function AppShell({
  onRefreshAll,
  navPlugins,
  pluginsMeta,
  pluginSettings,
  displayPlugins,
  autoUpdateNextAt,
  selectedPlugin,
  themeMode,
  onThemeModeChange,
  onPluginContextAction,
  isPluginRefreshAvailable,
  onNavReorder,
  onProviderToggle,
  appContentProps,
}: AppShellProps) {
  const [showProviderSettings, setShowProviderSettings] = useState(false)
  const {
    activeView,
    setActiveView,
    showAbout,
    setShowAbout,
  } = useAppUiStore(
    useShallow((state) => ({
      activeView: state.activeView,
      setActiveView: state.setActiveView,
      showAbout: state.showAbout,
      setShowAbout: state.setShowAbout,
    }))
  )

  const {
    containerRef,
    scrollRef,
    canScrollDown,
    maxPanelHeightPx,
  } = usePanel({
    activeView,
    setActiveView,
    showAbout,
    setShowAbout,
    displayPlugins,
  })

  const appVersion = useAppVersion()
  const { updateStatus, triggerInstall, checkForUpdates } = useAppUpdate()

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="flex flex-col items-center bg-transparent p-5 pt-1.5 outline-none"
    >
      <div className="tray-arrow" />
      <div
        className="relative flex w-full select-none flex-col overflow-hidden rounded-[16px] border border-line-bright bg-card"
        style={{
          boxShadow: "var(--panel-shadow)",
          ...(maxPanelHeightPx ? { maxHeight: `${maxPanelHeightPx - ARROW_OVERHEAD_PX}px` } : {}),
        }}
      >
        <div className="flex flex-1 min-h-0 flex-row">
          <SideNav
            activeView={activeView}
            onViewChange={setActiveView}
            plugins={navPlugins}
            onPluginContextAction={onPluginContextAction}
            isPluginRefreshAvailable={isPluginRefreshAvailable}
            onReorder={onNavReorder}
          />
          <div className="wt-dot-grid relative flex min-w-0 flex-1 flex-col bg-card px-4 pb-2 pt-4">
            <header className="flex items-start justify-between gap-3 pb-4">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="grid size-10 shrink-0 place-items-center rounded-[11px] border border-line bg-surface-raised">
                  <img src="/icon.png" alt="" className="size-6 object-contain" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-[19px] font-semibold leading-6 tracking-tight text-foreground">
                    Watchtower
                  </h1>
                  <p className="label-mono text-[9px] leading-3 text-muted-foreground/70">
                    AI Usage Monitor
                  </p>
                </div>
              </div>
              <div className="relative flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Refresh"
                  className="rounded-[10px] border border-line bg-surface text-foreground hover:border-line-bright hover:bg-surface-raised [&_svg]:transition-transform [&_svg]:duration-300 hover:[&_svg]:rotate-180"
                  onClick={onRefreshAll}
                >
                  <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                </Button>
                <ThemeToggleButton
                  themeMode={themeMode}
                  onThemeModeChange={onThemeModeChange}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Provider Settings"
                  aria-expanded={showProviderSettings}
                  className="rounded-[10px] border border-line bg-surface text-foreground hover:border-line-bright hover:bg-surface-raised"
                  onClick={() => setShowProviderSettings((value) => !value)}
                >
                  <HugeiconsIcon icon={Settings02Icon} className="size-4" />
                </Button>
              </div>
            </header>
            {showProviderSettings && (
              <ProviderSettingsPopover
                pluginsMeta={pluginsMeta}
                pluginSettings={pluginSettings}
                onProviderToggle={onProviderToggle}
              />
            )}
            <div className="relative flex-1 min-h-0">
              <div ref={scrollRef} className="h-full overflow-y-auto scrollbar-none">
                <AppContent
                  {...appContentProps}
                  displayPlugins={displayPlugins}
                  selectedPlugin={selectedPlugin}
                />
              </div>
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent transition-opacity duration-200 ${canScrollDown ? "opacity-100" : "opacity-0"}`}
              />
            </div>
            <PanelFooter
              version={appVersion}
              autoUpdateNextAt={autoUpdateNextAt}
              updateStatus={updateStatus}
              onUpdateInstall={triggerInstall}
              onUpdateCheck={checkForUpdates}
              onRefreshAll={onRefreshAll}
              showAbout={showAbout}
              onShowAbout={() => setShowAbout(true)}
              onCloseAbout={() => setShowAbout(false)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
