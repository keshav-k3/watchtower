import claudeIcon from "@/assets/providers/claude.svg"
import cursorDarkIcon from "@/assets/providers/cursor-dark.svg"
import cursorLightIcon from "@/assets/providers/cursor-light.svg"
import devinIcon from "@/assets/providers/devin.svg"
import geminiIcon from "@/assets/providers/gemini.svg"
import grokIcon from "@/assets/providers/grok.svg"
import kimiDarkIcon from "@/assets/providers/kimi-dark.svg"
import kimiLightIcon from "@/assets/providers/kimi-light.svg"
import kiroIcon from "@/assets/providers/kiro.svg"
import openaiIcon from "@/assets/providers/openai.svg"
import opencodeDarkIcon from "@/assets/providers/opencode-dark.svg"
import opencodeLightIcon from "@/assets/providers/opencode-light.svg"
import { cn } from "@/lib/utils"

type ProviderIconProps = {
  id: string
  name: string
  iconUrl?: string
  brandColor?: string
  className?: string
  active?: boolean
}

type ThemePair = { light: string; dark: string }

// Official artwork. Color and two-tone marks render as themselves.
// Single-color marks use the black/white template the brand publishes.
const COLOR_ICONS: Record<string, string> = {
  claude: claudeIcon,
  gemini: geminiIcon,
  kiro: kiroIcon,
}

const THEME_ICONS: Record<string, ThemePair> = {
  cursor: { light: cursorLightIcon, dark: cursorDarkIcon },
  kimi: { light: kimiLightIcon, dark: kimiDarkIcon },
  opencode: { light: opencodeLightIcon, dark: opencodeDarkIcon },
}

const MONO_ICONS: Record<string, string> = {
  codex: openaiIcon,
  openai: openaiIcon,
  devin: devinIcon,
  grok: grokIcon,
  "grok-bot": grokIcon,
  grokbot: grokIcon,
}

function isDarkTheme() {
  return document.documentElement.classList.contains("dark")
}

function BrandImage({
  src,
  name,
  className,
}: {
  src: string
  name: string
  className?: string
}) {
  return (
    <img
      src={src}
      alt={name}
      draggable={false}
      className={cn("block size-4 object-contain", className)}
    />
  )
}

export function ProviderIcon({
  id,
  name,
  iconUrl,
  brandColor,
  className,
  active = false,
}: ProviderIconProps) {
  const colorIcon = COLOR_ICONS[id]
  if (colorIcon) {
    return <BrandImage src={colorIcon} name={name} className={className} />
  }

  const themeIcon = THEME_ICONS[id]
  if (themeIcon) {
    return (
      <BrandImage
        src={isDarkTheme() ? themeIcon.dark : themeIcon.light}
        name={name}
        className={className}
      />
    )
  }

  const monoIcon = MONO_ICONS[id]
  const maskSource = monoIcon ?? iconUrl
  const maskImage = maskSource ? `url("${maskSource.replace(/"/g, "%22")}")` : undefined
  const maskStyle = maskImage
    ? {
        WebkitMaskImage: maskImage,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskImage,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        backgroundColor: monoIcon ? "var(--provider-icon-monochrome)" : brandColor ?? "currentColor",
        opacity: active || monoIcon ? 1 : 0.72,
      }
    : undefined

  return (
    <span
      role="img"
      aria-label={name}
      className={cn("inline-block size-4", className)}
      style={maskStyle}
    />
  )
}
