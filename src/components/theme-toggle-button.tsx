import { HugeiconsIcon } from "@hugeicons/react"
import { MoonIcon, Sun01Icon } from "@hugeicons-pro/core-solid-rounded"
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
      className="size-7 border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={() => onThemeModeChange(nextMode)}
    >
      <HugeiconsIcon icon={isLight ? MoonIcon : Sun01Icon} className="size-4" />
    </Button>
  )
}
