import type { ReactNode } from "react"
import { useShallow } from "zustand/react/shallow"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon } from "@hugeicons-pro/core-solid-rounded"
import { AppContent, type AppContentActionProps } from "@/components/app/app-content"
import { Button } from "@/components/ui/button"
import { PanelFooter } from "@/components/panel-footer"
import { SideNav, type NavPlugin, type PluginContextAction } from "@/components/side-nav"
import { ThemeToggleButton } from "@/components/theme-toggle-button"
import { WatchtowerMark } from "@/components/watchtower-mark"
import type { DisplayPluginState } from "@/hooks/app/use-app-plugin-views"
import type { PluginMeta } from "@/lib/plugin-types"
import type { PluginSettings, ThemeMode } from "@/lib/settings"
import { useAppVersion } from "@/hooks/app/use-app-version"
import { usePanel } from "@/hooks/app/use-panel"
import { useAppUpdate } from "@/hooks/use-app-update"
import { useAppUiStore } from "@/stores/app-ui-store"
import { usePanelVisibilityStore } from "@/stores/panel-visibility-store"

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
  notice?: ReactNode
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
  notice,
  onProviderToggle,
  appContentProps,
}: AppShellProps) {
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
    panelHeightPx,
  } = usePanel({
    activeView,
    setActiveView,
    showAbout,
    setShowAbout,
    displayPlugins,
  })

  const panelVisible = usePanelVisibilityStore((state) => state.visible)
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
        data-slot="app-panel"
        className="relative flex w-full select-none flex-col overflow-hidden rounded-[16px] border border-line-bright bg-card"
        style={{
          boxShadow: "var(--panel-shadow)",
          ...(panelHeightPx ? { height: `${panelHeightPx - ARROW_OVERHEAD_PX}px` } : {}),
        }}
      >
        <div className="flex flex-1 min-h-0 flex-row items-stretch">
          <SideNav
            activeView={activeView}
            onViewChange={setActiveView}
            plugins={navPlugins}
            onPluginContextAction={onPluginContextAction}
            isPluginRefreshAvailable={isPluginRefreshAvailable}
            onReorder={onNavReorder}
          />
          <div className="wt-dot-grid relative flex min-w-0 flex-1 flex-col bg-card">
            <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-4">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div
                  data-slot="app-logo"
                  className="grid size-10 shrink-0 place-items-center rounded-[11px] border border-line bg-surface-raised text-foreground"
                >
                  <WatchtowerMark className="size-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="break-words text-[19px] font-semibold leading-6 tracking-tight text-foreground">
                    Watchtower
                  </h1>
                  <p className="label-mono text-[9px] leading-3 text-muted-foreground/70">
                    AI Usage Monitor
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
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
              </div>
            </header>
            {notice}
            <div className="relative flex-1 min-h-0">
              <div ref={scrollRef} className="h-full overflow-y-auto scrollbar-none">
                <AppContent
                  {...appContentProps}
                  displayPlugins={displayPlugins}
                  selectedPlugin={selectedPlugin}
                  pluginsMeta={pluginsMeta}
                  pluginSettings={pluginSettings}
                  onProviderToggle={onProviderToggle}
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
              panelVisible={panelVisible}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
