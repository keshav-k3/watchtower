import { HugeiconsIcon } from "@hugeicons/react"
import { Moon02Icon, Sun01Icon } from "@hugeicons-pro/core-solid-rounded"
import { Button } from "@/components/ui/button"
import type { ThemeMode } from "@/lib/settings"

type ThemeToggleButtonProps = {
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
}

export function ThemeToggleButton({
  themeMode,
  onThemeModeChange,
}: ThemeToggleButtonProps) {
  const isLight = themeMode === "light"
  const nextMode: ThemeMode = isLight ? "dark" : "light"
  const label = isLight ? "Switch To Dark Theme" : "Switch To Light Theme"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className="rounded-[10px] border border-line bg-surface text-foreground hover:border-line-bright hover:bg-surface-raised"
      onClick={() => onThemeModeChange(nextMode)}
    >
      <HugeiconsIcon icon={isLight ? Moon02Icon : Sun01Icon} className="size-4" />
    </Button>
  )
}
