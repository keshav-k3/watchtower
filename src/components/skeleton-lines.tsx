import { Fragment } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { ManifestLine } from "@/lib/plugin-types"
import { groupLinesByType } from "@/lib/group-lines-by-type"

function SkeletonText({ label }: { label: string }) {
  return (
    <div className="flex justify-between items-center h-[18px]">
      <span className="label-mono text-[10px] text-muted-foreground">{label}</span>
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

function SkeletonBadge({ label }: { label: string }) {
  return (
    <div className="flex justify-between items-center h-[22px]">
      <span className="label-mono text-[10px] text-muted-foreground">{label}</span>
      <Skeleton className="h-[18px] w-16 rounded-[4px]" />
    </div>
  )
}

function SkeletonProgress({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <span className="label-mono pb-1 text-[10px] text-muted-foreground">{label}</span>
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="flex h-2.5 w-full items-stretch gap-[2px]">
        {Array.from({ length: 28 }).map((_, index) => (
          <div key={index} className="min-w-px flex-1 rounded-[1px] bg-line" />
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

function SkeletonBarChart({ label }: { label: string }) {
  return (
    <div className="flex h-[18px] items-center justify-between gap-2">
      <span className="label-mono min-w-0 truncate text-[10px] text-muted-foreground">{label}</span>
      <div className="flex h-4 w-1/2 max-w-[150px] flex-shrink-0 items-end justify-end gap-px">
        {Array.from({ length: 16 }).map((_, index) => (
          <Skeleton
            key={index}
            className="min-w-[2px] flex-1 rounded-[1px]"
            style={{ height: `${30 + ((index * 17) % 60)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function SkeletonLine({ line }: { line: ManifestLine }) {
  switch (line.type) {
    case "text":
      return <SkeletonText label={line.label} />
    case "badge":
      return <SkeletonBadge label={line.label} />
    case "progress":
      return <SkeletonProgress label={line.label} />
    case "barChart":
      return <SkeletonBarChart label={line.label} />
    default:
      return <SkeletonText label={line.label} />
  }
}

export function SkeletonLines({ lines }: { lines: ManifestLine[] }) {
  return (
    <div className="space-y-3.5">
      {groupLinesByType(lines).map((group, groupIndex) => (
        group.kind === "text" ? (
          <div key={groupIndex} className="space-y-1.5">
            {group.lines.map((line, lineIndex) => (
              <SkeletonLine key={`${line.label}-${groupIndex}-${lineIndex}`} line={line} />
            ))}
          </div>
        ) : (
          <Fragment key={groupIndex}>
            {group.lines.map((line, lineIndex) => (
              <SkeletonLine key={`${line.label}-${groupIndex}-${lineIndex}`} line={line} />
            ))}
          </Fragment>
        )
      ))}
    </div>
  )
}
