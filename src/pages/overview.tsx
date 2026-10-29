import { memo } from "react"
import { ProviderCard } from "@/components/provider-card"
import { CodexScopedProviderCard } from "@/components/codex-account-scope"
import { Button } from "@/components/ui/button"
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
  const cardProps = {
    id: plugin.meta.id,
    name: plugin.meta.name,
    iconUrl: plugin.meta.iconUrl,
    brandColor: plugin.meta.brandColor,
    plan: plugin.data?.plan,
    loading: plugin.loading,
    error: plugin.error,
    skeletonLines: plugin.meta.lines,
    lastManualRefreshAt: plugin.lastManualRefreshAt,
    lastUpdatedAt: plugin.lastUpdatedAt,
    onRetry: onRetryPlugin ? () => onRetryPlugin(plugin.meta.id) : undefined,
    scopeFilter: "overview" as const,
    displayMode,
    resetTimerDisplayMode,
    timeFormatMode,
    onResetTimerDisplayModeToggle,
  }
  const lines = plugin.data?.lines ?? []
  if (plugin.meta.id === "codex") {
    return <CodexScopedProviderCard {...cardProps} lines={lines} />
  }
  return <ProviderCard {...cardProps} lines={lines} />
})

interface OverviewPageProps {
  plugins: PluginDisplayState[]
  onRetryPlugin?: (pluginId: string) => void
  displayMode: DisplayMode
  resetTimerDisplayMode: ResetTimerDisplayMode
  timeFormatMode?: TimeFormatMode
  onResetTimerDisplayModeToggle?: () => void
  onChooseProviders?: () => void
}

export function OverviewPage({
  plugins,
  onRetryPlugin,
  displayMode,
  resetTimerDisplayMode,
  timeFormatMode = "auto",
  onResetTimerDisplayModeToggle,
  onChooseProviders,
}: OverviewPageProps) {
  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <p className="text-[13px] font-medium text-foreground">No Providers Yet</p>
        <p className="text-[12px] text-muted-foreground">Turn on the providers you want to watch.</p>
        {onChooseProviders && (
          <Button type="button" size="sm" variant="outline" onClick={onChooseProviders}>
            Choose Providers
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="divide-y divide-line px-3">
      {plugins.map((plugin, index) => (
        <div key={plugin.meta.id} className="wt-enter" style={{ animationDelay: `${Math.min(index, 3) * 30}ms` }}>
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
