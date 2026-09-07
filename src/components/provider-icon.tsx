import { cn } from "@/lib/utils"

type ProviderIconProps = {
  id: string
  name: string
  iconUrl?: string
  brandColor?: string
  className?: string
  active?: boolean
  sourcePluginId?: string
}

function iconColor(id: string, brandColor: string | undefined, sourcePluginId?: string): string {
  const key = sourcePluginId ?? id
  if (key === "claude") return "#d97757"
  if (key === "codex" || key === "cursor" || key === "opencode") {
    return "var(--provider-icon-monochrome)"
  }
  return brandColor ?? "currentColor"
}

export function ProviderIcon({
  id,
  name,
  iconUrl,
  brandColor,
  className,
  active = false,
  sourcePluginId,
}: ProviderIconProps) {
  const maskStyle = iconUrl
    ? {
        WebkitMaskImage: `url(${iconUrl})`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskImage: `url(${iconUrl})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }
    : {}

  if (id === "gemini") {
    return (
      <span
        role="img"
        aria-label={name}
        className={cn(
          "inline-block bg-[conic-gradient(from_25deg,#4285f4,#a142f4,#ea4335,#fbbc04,#34a853,#4285f4)]",
          className
        )}
        style={{
          ...maskStyle,
          filter: active ? "saturate(1.12)" : "saturate(0.95)",
        }}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={cn("inline-block", className)}
      style={{
        backgroundColor: iconColor(id, brandColor, sourcePluginId),
        ...maskStyle,
        opacity: active ? 1 : 0.72,
      }}
    />
  )
}
