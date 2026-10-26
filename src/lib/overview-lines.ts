const ACCOUNT_MARKER = " · "

/** Overview rows match a manifest label, including "Work · Session". */
export function isOverviewLine(label: string, overviewLabels: ReadonlySet<string>): boolean {
  if (overviewLabels.has(label)) return true
  const index = label.lastIndexOf(ACCOUNT_MARKER)
  if (index === -1) return false
  return overviewLabels.has(label.slice(index + ACCOUNT_MARKER.length))
}
