import { cn } from "@/lib/utils"

type ProviderIconProps = {
  id: string
  name: string
  iconUrl?: string
  brandColor?: string
  className?: string
  active?: boolean
}

/**
 * Every provider mark is drawn the same way: the plugin's single-color
 * artwork used as a mask and filled with the theme ink, so the sidebar and
 * cards read as one set in light and dark mode.
 */
export function ProviderIcon({ id, name, iconUrl, className, active = false }: ProviderIconProps) {
  const maskImage = iconUrl ? `url("${iconUrl.replace(/"/g, "%22")}")` : undefined
  const style = maskImage
    ? {
        WebkitMaskImage: maskImage,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskImage,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        backgroundColor: "var(--provider-icon-monochrome)",
        opacity: active ? 1 : 0.72,
      }
    : undefined

  return (
    <span
      role="img"
      aria-label={name}
      data-provider={id}
      className={cn("inline-block size-4", className)}
      style={style}
    />
  )
}
