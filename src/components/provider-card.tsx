import { Fragment, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ExternalLinkIcon,
  HourglassIcon,
  Loader03Icon,
  RefreshIcon,
} from "@hugeicons-pro/core-solid-rounded"
import { openUrl } from "@tauri-apps/plugin-opener"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SkeletonLines } from "@/components/skeleton-lines"
import { UsageSparkline } from "@/components/usage-sparkline"
import { PluginError } from "@/components/plugin-error"
import { ProviderIcon } from "@/components/provider-icon"
import { useNowTicker } from "@/hooks/use-now-ticker"
import { REFRESH_COOLDOWN_MS, type DisplayMode, type ResetTimerDisplayMode, type TimeFormatMode } from "@/lib/settings"
import type { ManifestLine, MetricLine, PluginLink } from "@/lib/plugin-types"
import { groupLinesByType } from "@/lib/group-lines-by-type"
import { cn, clamp01, formatCountNumber, formatFixedPrecisionNumber } from "@/lib/utils"
import { calculateDeficit, calculatePaceStatus, type PaceStatus } from "@/lib/pace-status"
import { buildPaceDetailText, formatDeficitText, formatRunsOutText, getPaceStatusText } from "@/lib/pace-tooltip"
import { formatResetAbsoluteLabel, formatResetRelativeLabel, formatResetTooltipText } from "@/lib/reset-tooltip"
import { isOverviewLine } from "@/lib/overview-lines"

interface ProviderCardProps {
  id: string
  name: string
  iconUrl: string
  brandColor?: string
  plan?: string
  links?: PluginLink[]
  showSeparator?: boolean
  loading?: boolean
  error?: string | null
  lines?: MetricLine[]
  skeletonLines?: ManifestLine[]
  lastManualRefreshAt?: number | null
  lastUpdatedAt?: number | null
  onRetry?: () => void
  scopeFilter?: "overview" | "all"
  displayMode: DisplayMode
  resetTimerDisplayMode?: ResetTimerDisplayMode
  timeFormatMode?: TimeFormatMode
  onResetTimerDisplayModeToggle?: () => void
}

const PACE_VISUALS: Record<PaceStatus, { dotClass: string }> = {
  ahead: { dotClass: "bg-muted-foreground" },
  "on-track": { dotClass: "bg-muted-foreground" },
  behind: { dotClass: "bg-warning" },
}

/** Colored dot indicator showing pace status */
function PaceIndicator({
  status,
  detailText,
  isLimitReached,
}: {
  status: PaceStatus
  detailText?: string | null
  isLimitReached?: boolean
}) {
  const colorClass = PACE_VISUALS[status].dotClass

  const statusText = getPaceStatusText(status)

  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <span
            {...props}
            className={`inline-block w-1.5 h-1.5 rounded-full ${colorClass}`}
            aria-label={isLimitReached ? "Limit reached" : statusText}
          />
        )}
      />
      <TooltipContent side="top" className="text-xs text-center">
        {isLimitReached ? (
          "Limit reached"
        ) : (
          <>
            <div>{statusText}</div>
            {detailText && <div className="text-[10px] opacity-60">{detailText}</div>}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function formatRelativeTime(diffMs: number): string {
  const seconds = Math.floor(Math.max(0, diffMs) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ProviderCard({
  id,
  name,
  iconUrl,
  brandColor,
  plan,
  links = [],
  loading = false,
  error = null,
  lines = [],
  skeletonLines = [],
  lastManualRefreshAt,
  lastUpdatedAt,
  onRetry,
  scopeFilter = "all",
  displayMode,
  resetTimerDisplayMode = "relative",
  timeFormatMode = "auto",
  onResetTimerDisplayModeToggle,
}: ProviderCardProps) {
  const cooldownRemainingMs = useMemo(() => {
    if (!lastManualRefreshAt) return 0
    const remaining = REFRESH_COOLDOWN_MS - (Date.now() - lastManualRefreshAt)
    return remaining > 0 ? remaining : 0
  }, [lastManualRefreshAt])

  // Filter lines based on scope - match by label since runtime lines can differ from manifest
  const overviewLabels = new Set(
    skeletonLines
      .filter(line => line.scope === "overview")
      .map(line => line.label)
  )
  const filteredSkeletonLines = scopeFilter === "all"
    ? skeletonLines
    : skeletonLines.filter(line => line.scope === "overview")
  const filteredLines = scopeFilter === "all"
    ? lines
    : lines.filter(line => isOverviewLine(line.label, overviewLabels))
  const visibleLines = filteredLines.filter(
    (line) => !(plan && line.type === "badge" && line.label.toLowerCase() === "plan")
  )

  const hasResetCountdown = filteredLines.some(
    (line) => line.type === "progress" && Boolean(line.resetsAt)
  )

  // "has ever loaded" — true if either we have a prior success timestamp,
  // or the parent is passing lines directly (tests + legacy state paths).
  const hasStaleData = lastUpdatedAt != null || visibleLines.length > 0
  const isRefreshingWithData = loading && hasStaleData

  const tickerIntervalMs = cooldownRemainingMs > 0 ? 1000 : 30_000

  const now = useNowTicker({
    enabled: cooldownRemainingMs > 0 || hasResetCountdown,
    intervalMs: tickerIntervalMs,
    stopAfterMs: cooldownRemainingMs > 0 && !hasResetCountdown ? cooldownRemainingMs : null,
  })

  const inCooldown = lastManualRefreshAt
    ? now - lastManualRefreshAt < REFRESH_COOLDOWN_MS
    : false

  const visibleLinks = useMemo(
    () =>
      links
        .map((link) => ({
          label: link.label.trim(),
          url: link.url.trim(),
        }))
        .filter(
          (link) =>
            link.label.length > 0 &&
            link.url.length > 0 &&
            (link.url.startsWith("https://") || link.url.startsWith("http://"))
        ),
    [links]
  )

  // Format remaining cooldown time as "Xm Ys"
  const formatRemainingTime = () => {
    /* v8 ignore next */
    if (!lastManualRefreshAt) return ""
    const remainingMs = REFRESH_COOLDOWN_MS - (now - lastManualRefreshAt)
    /* v8 ignore next */
    if (remainingMs <= 0) return ""
    const totalSeconds = Math.ceil(remainingMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 0) {
      return `Available in ${minutes}m ${seconds}s`
    }
    return `Available in ${seconds}s`
  }

  return (
    <section className="group py-2">
      <div>
        <div className="mb-1.5 flex items-start gap-2">
          <ProviderIcon
            id={id}
            name={name}
            iconUrl={iconUrl}
            brandColor={brandColor}
            active
            className="mt-0.5 size-4 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 break-words text-[13px] font-semibold leading-4 text-foreground">{name}</h2>
              <div className="flex shrink-0 items-center gap-1.5">
                {(loading || error) && (
                  <span
                    className={cn("size-1.5 rounded-full", loading ? "bg-warning" : "bg-destructive")}
                    aria-hidden="true"
                  />
                )}
            {onRetry && !error && (
              loading ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="pointer-events-none ml-0.5 opacity-50"
                  style={{ transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                  tabIndex={-1}
                >
                  <HugeiconsIcon icon={Loader03Icon} className="size-3 animate-spin" />
                </Button>
              ) : inCooldown ? (
                <Tooltip>
                  <TooltipTrigger
                    className="ml-0.5"
                    render={(props) => (
                      <span {...props} className={props.className}>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="pointer-events-none opacity-50"
                          style={{ transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                          tabIndex={-1}
                        >
                          <HugeiconsIcon icon={HourglassIcon} className="size-3" />
                        </Button>
                      </span>
                    )}
                  />
                  <TooltipContent side="top">
                    {formatRemainingTime()}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    className="ml-0.5"
                    render={(props) => (
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Retry"
                        onClick={(e) => {
                          e.currentTarget.blur()
                          onRetry()
                        }}
                        className="text-muted-foreground"
                        style={{ transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                      >
                        <HugeiconsIcon icon={RefreshIcon} className="size-3" />
                      </Button>
                    )}
                  />
                </Tooltip>
              )
            )}
              </div>
            </div>
            {(plan || lastUpdatedAt != null) && (
              <p className="mt-0.5 break-words text-[11px] leading-[14px] text-muted-foreground">
                {plan}
                {plan && lastUpdatedAt != null ? " · " : ""}
                {lastUpdatedAt != null ? `Updated ${formatRelativeTime(Date.now() - lastUpdatedAt)}` : ""}
              </p>
            )}
          </div>
        </div>
        {visibleLinks.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
            {visibleLinks.map((link) => (
              <button
                key={`${link.label}-${link.url}`}
                type="button"
                className="inline-flex max-w-full items-center gap-1 break-words text-left text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => {
                  openUrl(link.url).catch(console.error)
                }}
              >
                <span className="break-words">{link.label}</span>
                <HugeiconsIcon icon={ExternalLinkIcon} className="size-3 shrink-0" />
              </button>
            ))}
          </div>
        )}
        {error && !hasStaleData && (
          <div className="mb-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <PluginError message={error} />
            </div>
            {onRetry && !loading && (
              <button
                type="button"
                className="shrink-0 text-[12px] font-medium text-foreground underline-offset-2 hover:underline"
                onClick={() => onRetry()}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {error && hasStaleData && (
          <div className="mb-2 flex items-center gap-2 text-[12px] leading-4 text-destructive" title={error}>
            <span className="min-w-0 flex-1 truncate">{error}</span>
            {onRetry && !loading && (
              <button
                type="button"
                className="shrink-0 font-medium text-foreground underline-offset-2 hover:underline"
                onClick={() => onRetry()}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {loading && !hasStaleData && !error && (
          <SkeletonLines lines={filteredSkeletonLines} />
        )}

        {hasStaleData && (
          <div className="space-y-2">
            {groupLinesByType(visibleLines).map((group, gi) =>
              group.kind === "text" ? (
                <div key={gi} className="space-y-1.5">
                  {group.lines.map((line, li) => (
                    <MetricLineRenderer
                      key={`${line.label}-${gi}-${li}`}
                      line={line}
                      displayMode={displayMode}
                      resetTimerDisplayMode={resetTimerDisplayMode}
                      timeFormatMode={timeFormatMode}
                      onResetTimerDisplayModeToggle={onResetTimerDisplayModeToggle}
                      now={now}
                      refreshing={isRefreshingWithData}
                    />
                  ))}
                </div>
              ) : (
                <Fragment key={gi}>
                  {group.lines.map((line, li) => (
                    <MetricLineRenderer
                      key={`${line.label}-${gi}-${li}`}
                      line={line}
                      displayMode={displayMode}
                      resetTimerDisplayMode={resetTimerDisplayMode}
                      timeFormatMode={timeFormatMode}
                      onResetTimerDisplayModeToggle={onResetTimerDisplayModeToggle}
                      now={now}
                      refreshing={isRefreshingWithData}
                    />
                  ))}
                </Fragment>
              )
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function MetricLineRenderer({
  line,
  displayMode,
  resetTimerDisplayMode,
  timeFormatMode,
  onResetTimerDisplayModeToggle,
  now,
  refreshing,
}: {
  line: MetricLine
  displayMode: DisplayMode
  resetTimerDisplayMode: ResetTimerDisplayMode
  timeFormatMode: TimeFormatMode
  onResetTimerDisplayModeToggle?: () => void
  now: number
  refreshing?: boolean
}) {
  if (line.type === "text") {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground" title={line.label}>
            {line.label}
          </span>
          <span
            className="min-w-0 break-words text-right text-[12px] tabular-nums text-foreground"
            style={line.color ? { color: line.color } : undefined}
            title={line.value}
          >
            {line.value}
          </span>
        </div>
        {line.subtitle && (
          <div className="text-right text-[11px] text-muted-foreground">{line.subtitle}</div>
        )}
      </div>
    )
  }

  if (line.type === "badge") {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{line.label}</span>
          <span
            className="min-w-0 break-words text-right text-[12px] text-foreground"
            style={line.color ? { color: line.color } : undefined}
            title={line.text}
          >
            {line.text}
          </span>
        </div>
        {line.subtitle && (
          <div className="text-right text-[11px] text-muted-foreground">{line.subtitle}</div>
        )}
      </div>
    )
  }

  if (line.type === "barChart") {
    return (
      <UsageSparkline label={line.label} points={line.points} note={line.note} color={line.color} />
    )
  }

  if (line.type === "progress") {
    const resetsAtMs = line.resetsAt ? Date.parse(line.resetsAt) : Number.NaN
    const periodDurationMs = line.periodDurationMs
    const hasPaceContext = Number.isFinite(resetsAtMs) && Number.isFinite(periodDurationMs)
    const hasTimeMarkerContext = hasPaceContext && periodDurationMs! > 0
    const shownAmount =
      displayMode === "used"
        ? line.used
        : Math.max(0, line.limit - line.used)
    const percent = Math.round(clamp01(shownAmount / line.limit) * 10000) / 100
    const leftSuffix = displayMode === "left" ? " left" : ""
    const isLimitReached = line.used >= line.limit

    const primaryText =
      line.format.kind === "percent"
        ? `${Math.round(shownAmount)}%${leftSuffix}`
        : line.format.kind === "dollars"
          ? `$${formatFixedPrecisionNumber(shownAmount)}${leftSuffix}`
          : `${formatCountNumber(shownAmount)} ${line.format.suffix}${leftSuffix}`

    const resetLabel = line.resetsAt
      ? resetTimerDisplayMode === "absolute"
        ? formatResetAbsoluteLabel(now, line.resetsAt, timeFormatMode)
        : formatResetRelativeLabel(now, line.resetsAt)
      : null
    const resetTooltipText = line.resetsAt
      ? formatResetTooltipText({
          nowMs: now,
          resetsAtIso: line.resetsAt,
          visibleMode: resetTimerDisplayMode,
          timeFormatMode,
        })
      : null

    const secondaryText =
      resetLabel ??
      (line.format.kind === "percent"
        ? `${line.limit}% cap`
        : line.format.kind === "dollars"
          ? `$${formatFixedPrecisionNumber(line.limit)} limit`
          : `${formatCountNumber(line.limit)} ${line.format.suffix}`)

    // Calculate pace status if we have reset time and period duration
    const paceResult = hasPaceContext
      ? calculatePaceStatus(line.used, line.limit, resetsAtMs, periodDurationMs!, now)
      : null
    const paceStatus = paceResult?.status ?? null
    const paceMarkerValue = hasTimeMarkerContext && paceStatus && paceStatus !== "on-track"
      ? (() => {
          const periodStartMs = resetsAtMs - periodDurationMs!
          const elapsedFraction = clamp01((now - periodStartMs) / periodDurationMs!)
          const elapsedPercent = elapsedFraction * 100
          return displayMode === "used" ? elapsedPercent : 100 - elapsedPercent
        })()
      : undefined
    const paceDetailText =
      hasPaceContext && !isLimitReached
        ? buildPaceDetailText({
            paceResult,
            used: line.used,
            limit: line.limit,
            periodDurationMs: periodDurationMs!,
            resetsAtMs,
            nowMs: now,
            displayMode,
          })
        : null

    const deficit = hasPaceContext && !isLimitReached
      ? calculateDeficit(line.used, line.limit, resetsAtMs, periodDurationMs!, now)
      : null
    const deficitText = deficit !== null
      ? formatDeficitText(deficit, line.format, displayMode)
      : null
    const runsOutText = hasPaceContext && !isLimitReached
      ? formatRunsOutText({
          paceResult,
          used: line.used,
          limit: line.limit,
          periodDurationMs: periodDurationMs!,
          resetsAtMs,
          nowMs: now,
        })
      : null

    // Over-limit fills the bar in the signal color; otherwise honor plugin color.
    const barColor = isLimitReached
      ? "var(--destructive)"
      : paceStatus === "behind"
        ? "var(--warning)"
        : "var(--meter-fill)"

    return (
      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="break-words text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{line.label}</span>
            {paceStatus && (
              <PaceIndicator status={paceStatus} detailText={paceDetailText} isLimitReached={isLimitReached} />
            )}
          </div>
          <span
            className="shrink-0 text-[15px] font-semibold leading-none tabular-nums"
            style={{
              color: isLimitReached
                ? "var(--destructive)"
                : paceStatus === "behind"
                  ? "var(--warning)"
                  : "var(--foreground)",
            }}
          >
            {primaryText}
          </span>
        </div>
        <Progress
          value={percent}
          indicatorColor={barColor}
          markerValue={paceMarkerValue}
          refreshing={refreshing}
        />
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          {secondaryText && (
            resetTooltipText ? (
              <Tooltip>
                <TooltipTrigger
                  render={(props) =>
                    resetLabel && onResetTimerDisplayModeToggle ? (
                      <button
                        {...props}
                        type="button"
                        onClick={onResetTimerDisplayModeToggle}
                        className="text-left text-[11px] tabular-nums text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {secondaryText}
                      </button>
                    ) : (
                      <span {...props} className="text-[11px] tabular-nums text-muted-foreground">
                        {secondaryText}
                      </span>
                    )
                  }
                />
                <TooltipContent side="top">{resetTooltipText}</TooltipContent>
              </Tooltip>
            ) : /* v8 ignore next */ resetLabel && onResetTimerDisplayModeToggle ? (
              <button
                type="button"
                onClick={onResetTimerDisplayModeToggle}
                className="text-left text-[11px] tabular-nums text-muted-foreground transition-colors hover:text-foreground"
              >
                {secondaryText}
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {secondaryText}
              </span>
            )
          )}
        </div>
        {(deficitText || runsOutText) && (
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            {deficitText && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {deficitText}
              </span>
            )}
            {runsOutText && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {runsOutText}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return null
}
