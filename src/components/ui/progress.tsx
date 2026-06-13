import * as React from "react"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  indicatorColor?: string
  markerValue?: number
  refreshing?: boolean
  /** Number of discrete instrument segments. */
  segments?: number
}

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Segmented instrument bar. Discrete blocks light up left-to-right — the
 * signature Nothing-style data readout. The accessible value, pace marker, and
 * refreshing overlay are preserved for callers and tests.
 */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    { className, value = 0, indicatorColor, markerValue, refreshing, segments = 28, ...props },
    ref
  ) => {
    const clamped = Math.min(100, Math.max(0, value))

    // Light the segments up on mount (and animate when the value changes).
    const [mounted, setMounted] = React.useState(REDUCED_MOTION)
    React.useEffect(() => {
      const raf = requestAnimationFrame(() => setMounted(true))
      return () => cancelAnimationFrame(raf)
    }, [])

    const filled = Math.round((clamped / 100) * segments)
    const shownFilled = mounted ? filled : 0
    const fillColor = indicatorColor || "var(--display)"

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
        className={cn("relative flex h-2.5 w-full items-stretch gap-[2px]", className)}
        {...props}
      >
        {Array.from({ length: segments }).map((_, index) => {
          const isOn = index < shownFilled
          return (
            <div
              key={index}
              className="wt-seg min-w-px flex-1 rounded-[1px]"
              style={{
                backgroundColor: isOn ? fillColor : "var(--line)",
                transitionDelay: REDUCED_MOTION ? undefined : `${index * 11}ms`,
              }}
            />
          )
        })}
        {showMarker && (
          <div
            data-slot="progress-marker"
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-1px] top-[-1px] z-10 w-0.5 rounded-sm bg-muted-foreground ring-1 ring-background/70"
            style={markerStyle}
          />
        )}
        {refreshing && (
          <div
            data-slot="progress-refreshing"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1px]"
          >
            <div className="h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
        )}
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
