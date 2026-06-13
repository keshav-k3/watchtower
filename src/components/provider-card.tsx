import { Fragment, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ExternalLinkIcon,
  HourglassIcon,
  Loader03Icon,
  RefreshIcon,
} from "@hugeicons-pro/core-solid-rounded"
import { openUrl } from "@tauri-apps/plugin-opener"
import { Badge } from "@/components/ui/badge"
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
  ahead: { dotClass: "bg-green-500" },
  "on-track": { dotClass: "bg-yellow-500" },
  behind: { dotClass: "bg-red-500" },
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

type ProviderStatus = "live" | "syncing" | "attention"

const STATUS_VISUALS: Record<ProviderStatus, { label: string; dot: string; text: string; pulse: boolean }> = {
  live: { label: "LIVE", dot: "bg-green-500", text: "text-muted-foreground", pulse: true },
  syncing: { label: "SYNCING", dot: "bg-yellow-500", text: "text-muted-foreground", pulse: true },
  attention: { label: "ATTENTION", dot: "bg-destructive", text: "text-destructive", pulse: false },
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  const cfg = STATUS_VISUALS[status]
  return (
    <div className="flex shrink-0 items-center gap-1.5 pt-1">
      <span className={cn("size-1.5 rounded-full", cfg.dot, cfg.pulse && "wt-pulse")} />
      <span className={cn("label-mono text-[9px]", cfg.text)}>{cfg.label}</span>
    </div>
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
    : lines.filter(line => overviewLabels.has(line.label))
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

  const status: ProviderStatus = loading ? "syncing" : error ? "attention" : "live"

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
    if (!lastManualRefreshAt) return ""
    const remainingMs = REFRESH_COOLDOWN_MS - (now - lastManualRefreshAt)
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
    <section className="group relative overflow-hidden rounded-[14px] border border-line bg-surface px-3.5 py-3 transition-colors duration-200 hover:border-line-bright">
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="relative flex min-w-0 items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-raised ring-1 ring-line">
              <ProviderIcon
                id={id}
                name={name}
                iconUrl={iconUrl}
                brandColor={brandColor}
                active
                className="size-[18px]"
              />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-[15px] font-semibold leading-5 tracking-tight text-foreground" style={{ transform: "translateZ(0)" }}>{name}</h2>
                {plan && (
                  <Badge
                    variant="outline"
                    className="label-mono h-[18px] max-w-28 shrink-0 truncate rounded-[4px] border-line bg-transparent px-1.5 text-[9px] font-normal leading-none text-muted-foreground"
                    title={plan}
                  >
                    {plan}
                  </Badge>
                )}
              </div>
              {lastUpdatedAt != null && (
                <p className="label-mono mt-1 text-[9px] leading-3 text-muted-foreground/70">
                  Updated {formatRelativeTime(Date.now() - lastUpdatedAt)}
                </p>
              )}
            </div>
            {onRetry && (
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
                        className="opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
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
          <StatusBadge status={status} />
        </div>
        {visibleLinks.length > 0 && (
          <div className="mb-3 -mt-0.5 flex flex-wrap gap-1.5">
            {visibleLinks.map((link) => (
              <Button
                key={`${link.label}-${link.url}`}
                variant="outline"
                size="xs"
                className="label-mono h-6 max-w-full rounded-[6px] border-line bg-transparent text-[10px] text-muted-foreground hover:border-line-bright hover:text-foreground"
                onClick={() => {
                  openUrl(link.url).catch(console.error)
                }}
              >
                <span className="truncate">{link.label}</span>
                <HugeiconsIcon icon={ExternalLinkIcon} className="size-3 opacity-70" />
              </Button>
            ))}
          </div>
        )}
        {error && !hasStaleData && (
          <div className="rounded-[10px] border border-line border-l-2 border-l-destructive bg-destructive/[0.06] px-3 py-2.5">
            <PluginError message={error} />
          </div>
        )}

        {error && hasStaleData && (
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <div
                  {...props}
                  className="mb-2.5 flex items-center gap-1.5 rounded-[8px] border border-line border-l-2 border-l-destructive bg-destructive/[0.06] px-2 py-1.5 text-[12px] text-destructive"
                >
                  <HugeiconsIcon icon={AlertCircleIcon} className="size-3 flex-shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              )}
            />
            <TooltipContent side="top" className="max-w-xs break-words text-xs">
              {error}
            </TooltipContent>
          </Tooltip>
        )}

        {loading && !hasStaleData && !error && (
          <SkeletonLines lines={filteredSkeletonLines} />
        )}

        {hasStaleData && (
          <div className="space-y-3.5">
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
        <div className="flex justify-between items-center h-[18px] gap-2">
          <span className="label-mono min-w-0 truncate text-[10px] text-muted-foreground" title={line.label}>
            {line.label}
          </span>
          <span
            className="max-w-[45%] flex-shrink-0 truncate text-right font-mono text-[12px] tabular-nums text-foreground"
            style={line.color ? { color: line.color } : undefined}
            title={line.value}
          >
            {line.value}
          </span>
        </div>
        {line.subtitle && (
          <div className="label-mono -mt-0.5 text-right text-[9px] text-muted-foreground/70">{line.subtitle}</div>
        )}
      </div>
    )
  }

  if (line.type === "badge") {
    return (
      <div>
        <div className="flex justify-between items-center h-[22px]">
          <span className="label-mono flex-shrink-0 text-[10px] text-muted-foreground">{line.label}</span>
          <Badge
            variant="outline"
            className="label-mono min-w-0 max-w-[60%] truncate rounded-[4px] border-line bg-transparent text-[10px] font-normal text-foreground"
            style={
              line.color
                ? { color: line.color, borderColor: line.color }
                : undefined
            }
            title={line.text}
          >
            {line.text}
          </Badge>
        </div>
        {line.subtitle && (
          <div className="label-mono text-[9px] text-muted-foreground/70 text-right -mt-0.5">{line.subtitle}</div>
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
    const valueIsPercent = line.format.kind === "percent"

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
    const barColor = isLimitReached ? "var(--destructive)" : line.color

    return (
      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 pb-1">
            <span className="label-mono truncate text-[10px] text-muted-foreground">{line.label}</span>
            {paceStatus && (
              <PaceIndicator status={paceStatus} detailText={paceDetailText} isLimitReached={isLimitReached} />
            )}
          </div>
          <span
            className={cn(
              "shrink-0 leading-none tabular-nums",
              valueIsPercent ? "font-display text-[25px]" : "font-mono text-[16px] font-medium"
            )}
            style={{
              color: isLimitReached ? "var(--destructive)" : "var(--display)",
              fontWeight: valueIsPercent ? 600 : undefined,
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
        <div className="mt-2 flex items-center justify-end">
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
                        className="label-mono text-[10px] tabular-nums text-muted-foreground/80 transition-colors hover:text-foreground"
                      >
                        {secondaryText}
                      </button>
                    ) : (
                      <span {...props} className="label-mono text-[10px] tabular-nums text-muted-foreground/80">
                        {secondaryText}
                      </span>
                    )
                  }
                />
                <TooltipContent side="top">{resetTooltipText}</TooltipContent>
              </Tooltip>
            ) : resetLabel && onResetTimerDisplayModeToggle ? (
              <button
                type="button"
                onClick={onResetTimerDisplayModeToggle}
                className="label-mono text-[10px] tabular-nums text-muted-foreground/80 transition-colors hover:text-foreground"
              >
                {secondaryText}
              </button>
            ) : (
              <span className="label-mono text-[10px] text-muted-foreground/80">
                {secondaryText}
              </span>
            )
          )}
        </div>
        {(deficitText || runsOutText) && (
          <div className="mt-1 flex items-center justify-between">
            {deficitText && (
              <span className="label-mono text-[10px] tabular-nums text-muted-foreground/70">
                {deficitText}
              </span>
            )}
            {runsOutText && (
              <span className="label-mono ml-auto text-[10px] tabular-nums text-muted-foreground/70">
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
