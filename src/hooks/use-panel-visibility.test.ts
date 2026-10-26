import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { invokeMock, isTauriMock, listenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
  listenMock: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}))

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}))

import { usePanelVisibility } from "@/hooks/use-panel-visibility"
import { usePanelVisibilityStore } from "@/stores/panel-visibility-store"

describe("usePanelVisibility", () => {
  beforeEach(() => {
    invokeMock.mockReset()
    isTauriMock.mockReset()
    listenMock.mockReset()
    usePanelVisibilityStore.getState().setVisible(true)
    isTauriMock.mockReturnValue(true)
    invokeMock.mockResolvedValue(false)
    listenMock.mockResolvedValue(() => {})
  })

  it("does nothing outside the desktop app", () => {
    isTauriMock.mockReturnValue(false)
    renderHook(() => usePanelVisibility())
    expect(invokeMock).not.toHaveBeenCalled()
    expect(usePanelVisibilityStore.getState().visible).toBe(true)
  })

  it("reads the current visibility and follows later changes", async () => {
    let handler: ((event: { payload: unknown }) => void) | undefined
    const unlisten = vi.fn()
    listenMock.mockImplementation(async (_event: string, next: (event: { payload: unknown }) => void) => {
      handler = next
      return unlisten
    })

    const { unmount } = renderHook(() => usePanelVisibility())

    await waitFor(() => {
      expect(usePanelVisibilityStore.getState().visible).toBe(false)
    })
    expect(invokeMock).toHaveBeenCalledWith("panel_visible")

    handler?.({ payload: true })
    expect(usePanelVisibilityStore.getState().visible).toBe(true)
    handler?.({ payload: "nope" })
    expect(usePanelVisibilityStore.getState().visible).toBe(true)

    unmount()
    expect(unlisten).toHaveBeenCalled()
  })

  it("ignores a non-boolean visibility read", async () => {
    invokeMock.mockResolvedValue("open")
    renderHook(() => usePanelVisibility())
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled()
    })
    expect(usePanelVisibilityStore.getState().visible).toBe(true)
  })

  it("logs when the visibility read fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    invokeMock.mockRejectedValue(new Error("read failed"))
    renderHook(() => usePanelVisibility())
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith("Failed to read panel visibility:", expect.any(Error))
    })
    errorSpy.mockRestore()
  })

  it("logs when listening fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    listenMock.mockRejectedValue(new Error("listen failed"))
    renderHook(() => usePanelVisibility())
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to listen for panel visibility:",
        expect.any(Error)
      )
    })
    errorSpy.mockRestore()
  })

  it("drops a late visibility read after unmount", async () => {
    let resolveRead: ((value: boolean) => void) | undefined
    invokeMock.mockReturnValue(new Promise((resolve) => {
      resolveRead = resolve
    }))
    const { unmount } = renderHook(() => usePanelVisibility())
    unmount()
    resolveRead?.(false)
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled()
    })
    expect(usePanelVisibilityStore.getState().visible).toBe(true)
  })

  it("stops listening if the hook unmounts before the listener is attached", async () => {
    let resolveListen: ((unlisten: () => void) => void) | undefined
    const unlisten = vi.fn()
    invokeMock.mockResolvedValue(true)
    listenMock.mockReturnValue(new Promise((resolve) => {
      resolveListen = resolve
    }))
    const { unmount } = renderHook(() => usePanelVisibility())
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled()
    })
    unmount()
    resolveListen?.(unlisten)
    await waitFor(() => {
      expect(unlisten).toHaveBeenCalled()
    })
  })
})
