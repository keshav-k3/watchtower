import { describe, expect, it } from "vitest"
import { formatShortcutForDisplay, isMacPlatform, recordedModifier } from "@/lib/shortcut-format"

describe("isMacPlatform", () => {
  it("detects macOS from platform, userAgentData, or userAgent", () => {
    expect(isMacPlatform({ platform: "MacIntel" })).toBe(true)
    expect(isMacPlatform({ userAgentData: { platform: "macOS" } })).toBe(true)
    expect(isMacPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)" })).toBe(true)
  })

  it("treats Linux and Windows as non-mac", () => {
    expect(isMacPlatform({ platform: "Linux x86_64" })).toBe(false)
    expect(isMacPlatform({ platform: "Win32" })).toBe(false)
    expect(isMacPlatform({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15" })).toBe(false)
    expect(isMacPlatform(undefined)).toBe(false)
  })
})

describe("formatShortcutForDisplay", () => {
  it("shows Cmd for CommandOrControl on macOS", () => {
    expect(formatShortcutForDisplay("CommandOrControl+W", true)).toBe("Cmd + W")
    expect(formatShortcutForDisplay("CommandOrControl+Alt+Shift+U", true)).toBe("Cmd + Opt + Shift + U")
  })

  it("shows Ctrl for CommandOrControl on Linux and Windows", () => {
    expect(formatShortcutForDisplay("CommandOrControl+W", false)).toBe("Ctrl + W")
    expect(formatShortcutForDisplay("CmdOrCtrl+Shift+K", false)).toBe("Ctrl + Shift + K")
    expect(formatShortcutForDisplay("CommandOrControl+Alt+Delete", false)).toBe("Ctrl + Alt + Delete")
  })

  it("labels explicit modifiers per platform", () => {
    expect(formatShortcutForDisplay("Command+Control+Option+A", true)).toBe("Cmd + Ctrl + Opt + A")
    expect(formatShortcutForDisplay("Super+Control+Alt+A", false)).toBe("Super + Ctrl + Alt + A")
  })

  it("leaves key names alone", () => {
    expect(formatShortcutForDisplay("CommandOrControl+Return", false)).toBe("Ctrl + Return")
  })
})

describe("recordedModifier", () => {
  it("records Ctrl as CommandOrControl on Linux so the label and the registered keys agree", () => {
    expect(recordedModifier("Control", false)).toEqual({ accelerator: "CommandOrControl", label: "Ctrl" })
    expect(recordedModifier("Meta", false)).toEqual({ accelerator: "Super", label: "Super" })
    expect(recordedModifier("Alt", false)).toEqual({ accelerator: "Alt", label: "Alt" })
  })

  it("keeps the macOS behaviour: Cmd and Ctrl both record as CommandOrControl", () => {
    expect(recordedModifier("Meta", true)).toEqual({ accelerator: "CommandOrControl", label: "Cmd" })
    expect(recordedModifier("Control", true)).toEqual({ accelerator: "CommandOrControl", label: "Cmd" })
    expect(recordedModifier("Alt", true)).toEqual({ accelerator: "Alt", label: "Opt" })
    expect(recordedModifier("Shift", true)).toEqual({ accelerator: "Shift", label: "Shift" })
  })
})
