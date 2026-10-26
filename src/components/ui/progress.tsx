import * as React from "react"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  indicatorColor?: string
  markerValue?: number
  refreshing?: boolean
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/**
 * Thin continuous meter. Colour comes from the caller and is reserved for
 * over-limit and behind-pace states.
 */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorColor, markerValue, refreshing, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value))
    const reducedMotion = prefersReducedMotion()
    const [mounted, setMounted] = React.useState(reducedMotion)

    React.useEffect(() => {
      const raf = requestAnimationFrame(() => setMounted(true))
      return () => cancelAnimationFrame(raf)
    }, [])

    const shown = mounted ? clamped : 0
    const fillColor = indicatorColor || "var(--foreground)"

    const clampedMarker =
      typeof markerValue === "number" && Number.isFinite(markerValue)
        ? Math.min(100, Math.max(0, markerValue))
        : null
    const showMarker = clampedMarker !== null && clamped > 0 && clamped < 100
    const markerTransform =
      clampedMarker === null
        ? undefined
        : clampedMarker <= 0
          ? "translateX(0)"
          : clampedMarker >= 100
            ? "translateX(-100%)"
            : "translateX(-50%)"
    const markerStyle = showMarker
      ? {
          left: `${clampedMarker}%`,
          transform: markerTransform,
        }
      : undefined

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn("relative h-[3px] w-full overflow-hidden rounded-full bg-line", className)}
        {...props}
      >
        <div
          data-slot="progress-fill"
          className="h-full rounded-full"
          style={{
            width: `${shown}%`,
            backgroundColor: fillColor,
            transition: reducedMotion ? undefined : "width 150ms ease-out",
          }}
        />
        {showMarker && (
          <div
            data-slot="progress-marker"
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-1px] top-[-1px] z-10 w-px bg-muted-foreground"
            style={markerStyle}
          />
        )}
        {refreshing && (
          <div
            data-slot="progress-refreshing"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          </div>
        )}
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
