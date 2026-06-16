import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  currentMonitorMock,
  getCurrentWindowMock,
  invokeMock,
  isTauriMock,
  listenMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
  listenMock: vi.fn(),
  getCurrentWindowMock: vi.fn(),
  currentMonitorMock: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}))

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}))

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: getCurrentWindowMock,
  currentMonitor: currentMonitorMock,
  PhysicalSize: class PhysicalSize {
    width: number
    height: number

    constructor(width: number, height: number) {
      this.width = width
      this.height = height
    }
  },
}))

const resizeObserverCallbacks: Array<() => void> = []
let resizeObserverOriginal: typeof ResizeObserver | undefined

class InvokeResizeObserver {
  private callback: () => void

  constructor(callback: () => void) {
    this.callback = callback
  }

  observe() {
    resizeObserverCallbacks.push(this.callback)
    this.callback()
  }

  unobserve() {}

  disconnect() {}
}

function triggerResizeObservers() {
  for (const callback of resizeObserverCallbacks) {
    callback()
  }
}

import { usePanel } from "@/hooks/app/use-panel"

describe("usePanel", () => {
  let originalDocumentHiddenDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    resizeObserverCallbacks.length = 0
    resizeObserverOriginal = globalThis.ResizeObserver
    globalThis.ResizeObserver = InvokeResizeObserver as typeof ResizeObserver

    originalDocumentHiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden")
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    })

    invokeMock.mockReset()
    isTauriMock.mockReset()
    listenMock.mockReset()
    getCurrentWindowMock.mockReset()
    currentMonitorMock.mockReset()

    isTauriMock.mockReturnValue(true)
    invokeMock.mockResolvedValue(undefined)
    listenMock.mockResolvedValue(vi.fn())
    currentMonitorMock.mockResolvedValue(null)
    getCurrentWindowMock.mockReturnValue({ setSize: vi.fn().mockResolvedValue(undefined) })
  })

  afterEach(() => {
    if (resizeObserverOriginal) {
      globalThis.ResizeObserver = resizeObserverOriginal
    }

    if (originalDocumentHiddenDescriptor) {
      Object.defineProperty(document, "hidden", originalDocumentHiddenDescriptor)
    } else {
      Reflect.deleteProperty(document, "hidden")
    }
  })

  it("handles tray show-about event", async () => {
    const setShowAbout = vi.fn()
    const callbacks = new Map<string, (event: { payload: unknown }) => void>()

    listenMock.mockImplementation(async (event: string, callback: (event: { payload: unknown }) => void) => {
      callbacks.set(event, callback)
      return vi.fn()
    })

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout,
        displayPlugins: [],
      })
    )

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledTimes(2)
    })

    act(() => {
      callbacks.get("tray:show-about")?.({ payload: null })
    })

    expect(setShowAbout).toHaveBeenCalledWith(true)
  })

  it("cleans first listener if hook unmounts before setup resolves", async () => {
    const unlistenNavigate = vi.fn()
    let resolveNavigate: ((value: () => void) => void) | null = null

    listenMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNavigate = resolve
          })
      )
      .mockResolvedValue(vi.fn())

    const { unmount } = renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    unmount()
    resolveNavigate?.(unlistenNavigate)

    await waitFor(() => {
      expect(unlistenNavigate).toHaveBeenCalledTimes(1)
    })
  })

  it("cleans second listener if hook unmounts between listener registrations", async () => {
    const unlistenNavigate = vi.fn()
    const unlistenShowAbout = vi.fn()
    let resolveShowAbout: ((value: () => void) => void) | null = null

    listenMock
      .mockResolvedValueOnce(unlistenNavigate)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveShowAbout = resolve
          })
      )

    const { unmount } = renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledTimes(2)
    })

    unmount()
    resolveShowAbout?.(unlistenShowAbout)

    await waitFor(() => {
      expect(unlistenShowAbout).toHaveBeenCalledTimes(1)
    })
  })

  it("switches views with Cmd+Arrow navigation", () => {
    const setActiveView = vi.fn()

    const firstHook = renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
          {
            meta: { id: "b" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true }))
    })

    expect(setActiveView).toHaveBeenCalledWith("a")

    firstHook.unmount()
    setActiveView.mockClear()

    const secondHook = renderHook(() =>
      usePanel({
        activeView: "b",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
          {
            meta: { id: "b" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true }))
    })

    expect(setActiveView).toHaveBeenCalledWith("home")
    secondHook.unmount()
  })

  it("ignores Cmd+Arrow navigation from editable targets", () => {
    const setActiveView = vi.fn()
    const { result } = renderHook(() =>
      usePanel({
        activeView: "a",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    const textbox = document.createElement("div")
    textbox.setAttribute("role", "textbox")
    document.body.appendChild(textbox)

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true, bubbles: true }))
    })

    expect(setActiveView).toHaveBeenCalledWith("home")

    setActiveView.mockClear()

    act(() => {
      textbox.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true, bubbles: true }))
    })

    expect(setActiveView).not.toHaveBeenCalled()
    document.body.removeChild(textbox)
    expect(result.current.containerRef.current).toBeNull()
  })

  it("navigates visible provider views with Cmd+Arrow", () => {
    const setActiveView = vi.fn()

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
          {
            meta: { id: "b" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true }))
    })

    expect(setActiveView).toHaveBeenCalledWith("a")

    setActiveView.mockClear()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", metaKey: true }))
    })

    expect(setActiveView).toHaveBeenCalledWith("b")
  })

  it("focuses the panel container when the window regains focus", () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 0
      })

    const { result } = renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    const container = document.createElement("div")
    container.tabIndex = -1
    document.body.appendChild(container)

    act(() => {
      result.current.containerRef.current = container
    })

    act(() => {
      window.dispatchEvent(new Event("focus"))
    })

    expect(container).toHaveFocus()

    document.body.removeChild(container)
    requestAnimationFrameSpy.mockRestore()
  })

  it("focuses the panel container when the document becomes visible", () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 0
      })

    const { result } = renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    const container = document.createElement("div")
    container.tabIndex = -1
    document.body.appendChild(container)

    act(() => {
      result.current.containerRef.current = container
    })

    act(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    expect(container).not.toHaveFocus()

    act(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    expect(container).toHaveFocus()

    document.body.removeChild(container)
    requestAnimationFrameSpy.mockRestore()
  })

  it("invokes init_panel when running in Tauri", async () => {
    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("init_panel")
    })
  })

  it("does not invoke init_panel outside Tauri", async () => {
    isTauriMock.mockReturnValue(false)

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    await waitFor(() => {
      expect(invokeMock).not.toHaveBeenCalled()
    })
  })

  it("logs init_panel failures", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    invokeMock.mockRejectedValueOnce(new Error("init failed"))

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    consoleErrorSpy.mockRestore()
  })

  it("hides the panel on Escape in Tauri", async () => {
    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("hide_panel")
    })
  })

  it("does not hide the panel on Escape when about is open", () => {
    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: true,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })

    expect(invokeMock).not.toHaveBeenCalledWith("hide_panel")
  })

  it("does not hide the panel on Escape outside Tauri", () => {
    isTauriMock.mockReturnValue(false)

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView: vi.fn(),
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })

    expect(invokeMock).not.toHaveBeenCalledWith("hide_panel")
  })

  it("handles tray navigate event", async () => {
    const setActiveView = vi.fn()
    const callbacks = new Map<string, (event: { payload: unknown }) => void>()
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 0
      })

    listenMock.mockImplementation(async (event: string, callback: (event: { payload: unknown }) => void) => {
      callbacks.set(event, callback)
      return vi.fn()
    })

    const { result } = renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    const container = document.createElement("div")
    container.tabIndex = -1
    document.body.appendChild(container)

    act(() => {
      result.current.containerRef.current = container
    })

    await waitFor(() => {
      expect(listenMock).toHaveBeenCalledTimes(2)
    })

    act(() => {
      callbacks.get("tray:navigate")?.({ payload: "a" })
    })

    expect(setActiveView).toHaveBeenCalledWith("a")
    expect(container).toHaveFocus()

    document.body.removeChild(container)
    requestAnimationFrameSpy.mockRestore()
  })

  it("ignores keyboard navigation when default is prevented", () => {
    const setActiveView = vi.fn()

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true, cancelable: true })
      event.preventDefault()
      window.dispatchEvent(event)
    })

    expect(setActiveView).not.toHaveBeenCalled()
  })

  it("ignores keyboard navigation with modifier combinations other than Cmd alone", () => {
    const setActiveView = vi.fn()

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    const blockedEvents = [
      new KeyboardEvent("keydown", { key: "ArrowDown" }),
      new KeyboardEvent("keydown", { key: "ArrowDown", ctrlKey: true }),
      new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true, ctrlKey: true }),
      new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true, altKey: true }),
      new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true, shiftKey: true }),
      new KeyboardEvent("keydown", { key: "Enter", metaKey: true }),
    ]

    act(() => {
      for (const event of blockedEvents) {
        window.dispatchEvent(event)
      }
    })

    expect(setActiveView).not.toHaveBeenCalled()
  })

  it("ignores keyboard navigation when about is open", () => {
    const setActiveView = vi.fn()

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView,
        showAbout: true,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true }))
    })

    expect(setActiveView).not.toHaveBeenCalled()
  })

  it("ignores keyboard navigation for unknown active views", () => {
    const setActiveView = vi.fn()

    renderHook(() =>
      usePanel({
        activeView: "missing",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true }))
    })

    expect(setActiveView).not.toHaveBeenCalled()
  })

  it("navigates when the event target is a non-editable element", () => {
    const setActiveView = vi.fn()
    const panel = document.createElement("div")
    document.body.appendChild(panel)

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true })
      Object.defineProperty(event, "target", { value: panel })
      window.dispatchEvent(event)
    })

    expect(setActiveView).toHaveBeenCalledWith("a")

    document.body.removeChild(panel)
  })

  it("does not navigate when only the home view is available", () => {
    const setActiveView = vi.fn()

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [],
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true }))
    })

    expect(setActiveView).not.toHaveBeenCalled()
  })

  it("ignores keyboard navigation from form controls", () => {
    const setActiveView = vi.fn()
    const input = document.createElement("input")
    const textarea = document.createElement("textarea")
    const select = document.createElement("select")
    const editable = document.createElement("div")
    editable.setAttribute("contenteditable", "true")

    document.body.append(input, textarea, select, editable)

    renderHook(() =>
      usePanel({
        activeView: "home",
        setActiveView,
        showAbout: false,
        setShowAbout: vi.fn(),
        displayPlugins: [
          {
            meta: { id: "a" },
            data: null,
            loading: false,
            error: null,
            lastManualRefreshAt: null,
          } as any,
        ],
      })
    )

    const blockedTargets = [input, textarea, select, editable]

    for (const target of blockedTargets) {
      setActiveView.mockClear()

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true, bubbles: true })
        Object.defineProperty(event, "target", { value: target })
        window.dispatchEvent(event)
      })

      expect(setActiveView).not.toHaveBeenCalled()
    }

    document.body.removeChild(input)
    document.body.removeChild(textarea)
    document.body.removeChild(select)
    document.body.removeChild(editable)
  })

  it("resizes the window using monitor dimensions when available", async () => {
    const setSize = vi.fn().mockResolvedValue(undefined)
    getCurrentWindowMock.mockReturnValue({ setSize })
    currentMonitorMock.mockRejectedValue(new Error("monitor unavailable"))

    Object.defineProperty(window, "screen", {
      configurable: true,
      value: { availHeight: 800 },
    })

    const { result, rerender } = renderHook(
      ({ activeView }) =>
        usePanel({
          activeView,
          setActiveView: vi.fn(),
          showAbout: false,
          setShowAbout: vi.fn(),
          displayPlugins: [],
        }),
      { initialProps: { activeView: "home" as const } }
    )

    const container = document.createElement("div")
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 300 })
    document.body.appendChild(container)

    act(() => {
      result.current.containerRef.current = container
    })

    rerender({ activeView: "a" })

    await waitFor(() => {
      expect(result.current.maxPanelHeightPx).toBe(640)
    })

    document.body.removeChild(container)
  })

  it("uses monitor height when available", async () => {
    const setSize = vi.fn().mockResolvedValue(undefined)
    getCurrentWindowMock.mockReturnValue({ setSize })
    currentMonitorMock.mockResolvedValue({ size: { height: 1000 } })

    const { result, rerender } = renderHook(
      ({ activeView }) =>
        usePanel({
          activeView,
          setActiveView: vi.fn(),
          showAbout: false,
          setShowAbout: vi.fn(),
          displayPlugins: [],
        }),
      { initialProps: { activeView: "home" as const } }
    )

    const container = document.createElement("div")
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 500 })
    document.body.appendChild(container)

    act(() => {
      result.current.containerRef.current = container
    })

    rerender({ activeView: "a" })

    await waitFor(() => {
      expect(result.current.maxPanelHeightPx).toBe(800)
    })

    document.body.removeChild(container)
  })

  it("uses fallback height when monitor is unavailable and screen height is missing", async () => {
    const setSize = vi.fn().mockResolvedValue(undefined)
    getCurrentWindowMock.mockReturnValue({ setSize })
    currentMonitorMock.mockResolvedValue(null)

    Object.defineProperty(window, "screen", {
      configurable: true,
      value: { availHeight: Number.NaN },
    })

    const { result, rerender } = renderHook(
      ({ activeView }) =>
        usePanel({
          activeView,
          setActiveView: vi.fn(),
          showAbout: false,
          setShowAbout: vi.fn(),
          displayPlugins: [],
        }),
      { initialProps: { activeView: "home" as const } }
    )

    const container = document.createElement("div")
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 200 })
    document.body.appendChild(container)

    act(() => {
      result.current.containerRef.current = container
    })

    rerender({ activeView: "a" })

    await waitFor(() => {
      expect(result.current.maxPanelHeightPx).toBe(480)
    })

    document.body.removeChild(container)
  })

  it("logs window resize failures", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const setSize = vi.fn().mockRejectedValue(new Error("resize failed"))
    getCurrentWindowMock.mockReturnValue({ setSize })

    const { result, rerender } = renderHook(
      ({ activeView }) =>
        usePanel({
          activeView,
          setActiveView: vi.fn(),
          showAbout: false,
          setShowAbout: vi.fn(),
          displayPlugins: [],
        }),
      { initialProps: { activeView: "home" as const } }
    )

    const container = document.createElement("div")
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 250 })
    document.body.appendChild(container)

    act(() => {
      result.current.containerRef.current = container
    })

    rerender({ activeView: "a" })

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to resize window:", expect.any(Error))
    })

    consoleErrorSpy.mockRestore()
    document.body.removeChild(container)
  })

  it("resizes again when the container ResizeObserver fires", async () => {
    const setSize = vi.fn().mockResolvedValue(undefined)
    getCurrentWindowMock.mockReturnValue({ setSize })

    const { result, rerender } = renderHook(
      ({ activeView }) =>
        usePanel({
          activeView,
          setActiveView: vi.fn(),
          showAbout: false,
          setShowAbout: vi.fn(),
          displayPlugins: [],
        }),
      { initialProps: { activeView: "home" as const } }
    )

    const container = document.createElement("div")
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 200 })
    document.body.appendChild(container)

    act(() => {
      result.current.containerRef.current = container
    })

    rerender({ activeView: "a" })

    await waitFor(() => {
      expect(setSize).toHaveBeenCalled()
    })

    setSize.mockClear()
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 450 })

    act(() => {
      triggerResizeObservers()
    })

    await waitFor(() => {
      expect(setSize).toHaveBeenCalled()
    })

    const physicalSize = setSize.mock.calls.at(-1)?.[0]
    expect(physicalSize.height).toBe(450)

    document.body.removeChild(container)
  })

  it("tracks whether content can scroll down", async () => {
    const { result, rerender } = renderHook(
      ({ activeView }) =>
        usePanel({
          activeView,
          setActiveView: vi.fn(),
          showAbout: false,
          setShowAbout: vi.fn(),
          displayPlugins: [],
        }),
      { initialProps: { activeView: "home" as const } }
    )

    const scrollEl = document.createElement("div")
    let scrollTop = 0
    let scrollHeight = 200

    Object.defineProperty(scrollEl, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    })
    Object.defineProperty(scrollEl, "clientHeight", {
      configurable: true,
      get: () => 100,
    })
    Object.defineProperty(scrollEl, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    document.body.appendChild(scrollEl)

    act(() => {
      result.current.scrollRef.current = scrollEl
    })

    rerender({ activeView: "providers" })

    await waitFor(() => {
      expect(result.current.canScrollDown).toBe(true)
    })

    act(() => {
      scrollTop = 99
      scrollEl.dispatchEvent(new Event("scroll"))
    })

    expect(result.current.canScrollDown).toBe(false)

    act(() => {
      scrollHeight = 250
      scrollEl.appendChild(document.createElement("div"))
    })

    await waitFor(() => {
      expect(result.current.canScrollDown).toBe(true)
    })

    document.body.removeChild(scrollEl)
  })
})
