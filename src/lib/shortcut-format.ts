// Display and recording helpers for the global shortcut.
//
// Shortcuts are stored as Tauri accelerators. "CommandOrControl" is Cmd on
// macOS and Ctrl on Linux and Windows, so the label has to follow the
// platform the app is running on.

type NavigatorLike = {
  platform?: string
  userAgent?: string
  userAgentData?: { platform?: string }
}

export function isMacPlatform(nav: NavigatorLike | undefined = globalThis.navigator): boolean {
  if (!nav) return false
  const hint = nav.userAgentData?.platform || nav.platform || nav.userAgent || ""
  return /mac|iphone|ipad|ipod/i.test(hint)
}

function displayModifier(token: string, mac: boolean): string | null {
  switch (token.toLowerCase()) {
    case "commandorcontrol":
    case "cmdorctrl":
    case "commandorctrl":
    case "cmdorcontrol":
      return mac ? "Cmd" : "Ctrl"
    case "command":
    case "cmd":
    case "super":
    case "meta":
      return mac ? "Cmd" : "Super"
    case "control":
    case "ctrl":
      return "Ctrl"
    case "option":
    case "alt":
      return mac ? "Opt" : "Alt"
    case "shift":
      return "Shift"
    default:
      return null
  }
}

// e.g. "CommandOrControl+Shift+U" -> "Cmd + Shift + U" on macOS,
// "Ctrl + Shift + U" on Linux and Windows.
export function formatShortcutForDisplay(shortcut: string, mac: boolean = isMacPlatform()): string {
  return shortcut
    .split("+")
    .map((token) => displayModifier(token, mac) ?? token)
    .join(" + ")
}

export type RecordedModifier = { accelerator: string; label: string }

// Maps a pressed modifier to the accelerator token that registers the same
// keys on this platform, plus its label.
export function recordedModifier(
  modifier: "Meta" | "Control" | "Alt" | "Shift",
  mac: boolean = isMacPlatform()
): RecordedModifier {
  if (modifier === "Shift") return { accelerator: "Shift", label: "Shift" }
  if (modifier === "Alt") return { accelerator: "Alt", label: mac ? "Opt" : "Alt" }
  if (mac) {
    // macOS keeps treating Ctrl and Cmd as the primary modifier, as before.
    return { accelerator: "CommandOrControl", label: "Cmd" }
  }
  if (modifier === "Control") return { accelerator: "CommandOrControl", label: "Ctrl" }
  return { accelerator: "Super", label: "Super" }
}
