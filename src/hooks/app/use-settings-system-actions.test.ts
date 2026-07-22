import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  invokeMock,
  saveGlobalShortcutMock,
} = vi.hoisted(() => ({
  saveGlobalShortcutMock: vi.fn(),
  invokeMock: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}))

vi.mock("@/lib/settings", () => ({
  saveGlobalShortcut: saveGlobalShortcutMock,
}))

import { useSettingsSystemActions } from "@/hooks/app/use-settings-system-actions"

describe("useSettingsSystemActions", () => {
  beforeEach(() => {
    saveGlobalShortcutMock.mockReset()
    invokeMock.mockReset()

    saveGlobalShortcutMock.mockResolvedValue(undefined)
    invokeMock.mockResolvedValue(undefined)
  })

  it("updates shortcut settings", () => {
    const setGlobalShortcut = vi.fn()

    const { result } = renderHook(() =>
      useSettingsSystemActions({
        setGlobalShortcut,
      })
    )

    act(() => {
      result.current.handleGlobalShortcutChange("CommandOrControl+Shift+O")
    })

    expect(setGlobalShortcut).toHaveBeenCalledWith("CommandOrControl+Shift+O")
    expect(saveGlobalShortcutMock).toHaveBeenCalledWith("CommandOrControl+Shift+O")
    expect(invokeMock).toHaveBeenCalledWith("update_global_shortcut", {
      shortcut: "CommandOrControl+Shift+O",
    })
  })

  it("logs persistence/update failures", async () => {
    const shortcutSaveError = new Error("shortcut save failed")
    const shortcutInvokeError = new Error("shortcut invoke failed")
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    saveGlobalShortcutMock.mockRejectedValueOnce(shortcutSaveError)
    invokeMock.mockRejectedValueOnce(shortcutInvokeError)

    const { result } = renderHook(() =>
      useSettingsSystemActions({
        setGlobalShortcut: vi.fn(),
      })
    )

    act(() => {
      result.current.handleGlobalShortcutChange(null)
    })

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith("Failed to save global shortcut:", shortcutSaveError)
      expect(errorSpy).toHaveBeenCalledWith("Failed to update global shortcut:", shortcutInvokeError)
    })

    errorSpy.mockRestore()
  })
})
