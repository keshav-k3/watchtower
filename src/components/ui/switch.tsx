import { cn } from "@/lib/utils"

type SwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  "aria-label"?: string
}

export function Switch({ checked, onCheckedChange, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-4 w-7 shrink-0 rounded-full border transition-colors",
        checked ? "border-transparent bg-foreground" : "border-line bg-surface"
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full transition-transform",
          checked ? "translate-x-[13px] bg-background" : "translate-x-0.5 bg-muted-foreground"
        )}
      />
    </button>
  )
}
