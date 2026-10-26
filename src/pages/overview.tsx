import { memo } from "react"
import { ProviderCard } from "@/components/provider-card"
import type { PluginDisplayState } from "@/lib/plugin-types"
import type { DisplayMode, ResetTimerDisplayMode, TimeFormatMode } from "@/lib/settings"

const ProviderRow = memo(function ProviderRow({
  plugin,
  displayMode,
  resetTimerDisplayMode,
  timeFormatMode,
  onResetTimerDisplayModeToggle,
  onRetryPlugin,
}: {
  plugin: PluginDisplayState
  displayMode: DisplayMode
  resetTimerDisplayMode: ResetTimerDisplayMode
  timeFormatMode: TimeFormatMode
  onResetTimerDisplayModeToggle?: () => void
  onRetryPlugin?: (pluginId: string) => void
}) {
  return (
    <ProviderCard
      id={plugin.meta.id}
      name={plugin.meta.name}
      iconUrl={plugin.meta.iconUrl}
      brandColor={plugin.meta.brandColor}
      plan={plugin.data?.plan}
      loading={plugin.loading}
      error={plugin.error}
      lines={plugin.data?.lines ?? []}
      skeletonLines={plugin.meta.lines}
      lastManualRefreshAt={plugin.lastManualRefreshAt}
      lastUpdatedAt={plugin.lastUpdatedAt}
      onRetry={onRetryPlugin ? () => onRetryPlugin(plugin.meta.id) : undefined}
      scopeFilter="overview"
      displayMode={displayMode}
      resetTimerDisplayMode={resetTimerDisplayMode}
      timeFormatMode={timeFormatMode}
      onResetTimerDisplayModeToggle={onResetTimerDisplayModeToggle}
    />
  )
})

interface OverviewPageProps {
  plugins: PluginDisplayState[]
  onRetryPlugin?: (pluginId: string) => void
  displayMode: DisplayMode
  resetTimerDisplayMode: ResetTimerDisplayMode
  timeFormatMode?: TimeFormatMode
  onResetTimerDisplayModeToggle?: () => void
}

export function OverviewPage({
  plugins,
  onRetryPlugin,
  displayMode,
  resetTimerDisplayMode,
  timeFormatMode = "auto",
  onResetTimerDisplayModeToggle,
}: OverviewPageProps) {
  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="label-mono text-[11px] text-muted-foreground">No Providers Available</span>
        <span className="label-mono text-[9px] text-muted-foreground/60">Enable A Provider In Settings</span>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-5">
      {plugins.map((plugin, index) => (
        <div key={plugin.meta.id} className="wt-enter" style={{ animationDelay: `${index * 55}ms` }}>
          <ProviderRow
            plugin={plugin}
            displayMode={displayMode}
            resetTimerDisplayMode={resetTimerDisplayMode}
            timeFormatMode={timeFormatMode}
            onResetTimerDisplayModeToggle={onResetTimerDisplayModeToggle}
            onRetryPlugin={onRetryPlugin}
          />
        </div>
      ))}
    </div>
  )
}
