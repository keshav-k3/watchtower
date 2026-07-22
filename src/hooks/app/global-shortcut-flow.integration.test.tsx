import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useState } from "react"
import { renderHook } from "@testing-library/react"

const {
  storeState,
  storeSaveMock,
  invokeMock,
  isTauriMock,
} = vi.hoisted(() => ({
  storeState: new Map<string, unknown>(),
  storeSaveMock: vi.fn(),
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(() => true),
}))

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    async get<T>(key: string): Promise<T | null> {
      if (!storeState.has(key)) return undefined as T | null
      return storeState.get(key) as T | null
    }
    async set<T>(key: string, value: T): Promise<void> {
      storeState.set(key, value)
    }
    async save(): Promise<void> {
      storeSaveMock()
    }
  },
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}))

vi.mock("@tauri-apps/plugin-autostart", () => ({
  disable: vi.fn(),
  enable: vi.fn(),
  isEnabled: vi.fn(async () => true),
}))

import { GlobalShortcutSection } from "@/components/global-shortcut-section"
import { useSettingsSystemActions } from "@/hooks/app/use-settings-system-actions"
import { useSettingsBootstrap } from "@/hooks/app/use-settings-bootstrap"
import {
  DEFAULT_GLOBAL_SHORTCUT,
  loadGlobalShortcut,
  type GlobalShortcut,
} from "@/lib/settings"

function ShortcutSettingsHarness() {
  const [globalShortcut, setGlobalShortcut] = useState<GlobalShortcut>(DEFAULT_GLOBAL_SHORTCUT)
  const { handleGlobalShortcutChange } = useSettingsSystemActions({ setGlobalShortcut })

  return (
    <GlobalShortcutSection
      globalShortcut={globalShortcut}
      onGlobalShortcutChange={handleGlobalShortcutChange}
    />
  )
}

async function recordShortcut(combo: Array<{ key: string; code: string }>) {
  await userEvent.click(screen.getByRole("button", { name: /Cmd \+ W|Click to set/i }))
  const textbox = screen.getByRole("textbox", { name: /Press keys to record shortcut/i })
  for (const key of combo) {
    fireEvent.keyDown(textbox, key)
  }
  for (const key of [...combo].reverse()) {
    fireEvent.keyUp(textbox, key)
  }
}

describe("global shortcut save and apply flow", () => {
  beforeEach(() => {
    storeState.clear()
    storeSaveMock.mockReset()
    invokeMock.mockReset()
    isTauriMock.mockReset()
    isTauriMock.mockReturnValue(true)
    invokeMock.mockResolvedValue(undefined)
  })

  it("records a shortcut, persists it, and registers it through Tauri", async () => {
    render(<ShortcutSettingsHarness />)

    await recordShortcut([
      { key: "Meta", code: "MetaLeft" },
      { key: "Shift", code: "ShiftLeft" },
      { key: "O", code: "KeyO" },
    ])

    await waitFor(() => {
      expect(screen.getByText("Cmd + Shift + O")).toBeInTheDocument()
      expect(storeState.get("globalShortcut")).toBe("CommandOrControl+Shift+O")
      expect(storeSaveMock).toHaveBeenCalled()
      expect(invokeMock).toHaveBeenCalledWith("update_global_shortcut", {
        shortcut: "CommandOrControl+Shift+O",
      })
    })

    await expect(loadGlobalShortcut()).resolves.toBe("CommandOrControl+Shift+O")
  })

  it("reloads the saved shortcut on bootstrap and re-registers it", async () => {
    storeState.set("globalShortcut", "CommandOrControl+Shift+O")

    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "list_plugins") {
        return [
          {
            id: "codex",
            name: "Codex",
            iconUrl: "/codex.svg",
            brandColor: "#000000",
            lines: [],
            primaryCandidates: [],
          },
        ]
      }
      return undefined
    })

    const setGlobalShortcut = vi.fn()
    renderHook(() =>
      useSettingsBootstrap({
        setPluginSettings: vi.fn(),
        setPluginsMeta: vi.fn(),
        setAutoUpdateInterval: vi.fn(),
        setThemeMode: vi.fn(),
        setDisplayMode: vi.fn(),
        setResetTimerDisplayMode: vi.fn(),
        setTimeFormatMode: vi.fn(),
        setGlobalShortcut,
        setStartOnLogin: vi.fn(),
        setMenubarIconStyle: vi.fn(),
        setMenubarMetric: vi.fn(),
        setLoadingForPlugins: vi.fn(),
        setErrorForPlugins: vi.fn(),
        startBatch: vi.fn().mockResolvedValue(undefined),
      })
    )

    await waitFor(() => {
      expect(setGlobalShortcut).toHaveBeenCalledWith("CommandOrControl+Shift+O")
      expect(invokeMock).toHaveBeenCalledWith("update_global_shortcut", {
        shortcut: "CommandOrControl+Shift+O",
      })
    })
  })

  it("clears the shortcut, persists null, and unregisters it", async () => {
    storeState.set("globalShortcut", "CommandOrControl+Shift+O")
    render(<ShortcutSettingsHarness />)

    // Harness starts from default display; seed the visible value by recording first.
    await recordShortcut([
      { key: "Meta", code: "MetaLeft" },
      { key: "Shift", code: "ShiftLeft" },
      { key: "O", code: "KeyO" },
    ])

    await waitFor(() => {
      expect(screen.getByText("Cmd + Shift + O")).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole("button", { name: /Clear shortcut/i }))

    await waitFor(() => {
      expect(storeState.get("globalShortcut")).toBeNull()
      expect(invokeMock).toHaveBeenCalledWith("update_global_shortcut", {
        shortcut: null,
      })
      expect(screen.getAllByText("Click to set").length).toBeGreaterThan(0)
    })
  })
})
