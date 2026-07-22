import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GlobalShortcutSection } from "@/components/global-shortcut-section"

function renderSection(globalShortcut: string | null = null) {
  const onGlobalShortcutChange = vi.fn()
  render(
    <GlobalShortcutSection
      globalShortcut={globalShortcut}
      onGlobalShortcutChange={onGlobalShortcutChange}
    />
  )
  return { onGlobalShortcutChange }
}

async function startRecording() {
  await userEvent.click(screen.getByRole("button", { name: /Click to set/i }))
  return screen.getByRole("textbox", { name: /Press keys to record shortcut/i })
}

describe("GlobalShortcutSection", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("formats persisted shortcuts for display", () => {
    renderSection("CommandOrControl+Alt+Delete")
    expect(screen.getByText("Cmd + Opt + Delete")).toBeInTheDocument()
  })

  it("formats Command, Control, and Option aliases for display", () => {
    const { unmount } = render(
      <GlobalShortcutSection
        globalShortcut="Command+Control+Option+A"
        onGlobalShortcutChange={vi.fn()}
      />
    )
    expect(screen.getByText("Cmd + Ctrl + Opt + A")).toBeInTheDocument()
    unmount()
  })

  it("records digit keys and punctuation special keys", async () => {
    const { onGlobalShortcutChange } = renderSection()
    const textbox = await startRecording()

    fireEvent.keyDown(textbox, { key: "Meta", code: "MetaRight" })
    fireEvent.keyDown(textbox, { key: "2", code: "Digit2" })
    expect(screen.getByText("Cmd + 2")).toBeInTheDocument()
    fireEvent.keyUp(textbox, { key: "2", code: "Digit2" })
    fireEvent.keyUp(textbox, { key: "Meta", code: "MetaRight" })
    expect(onGlobalShortcutChange).toHaveBeenLastCalledWith("CommandOrControl+2")

    const textbox2 = await startRecording()
    fireEvent.keyDown(textbox2, { key: "Control", code: "ControlRight" })
    fireEvent.keyDown(textbox2, { key: "[", code: "BracketLeft" })
    expect(screen.getByText("Cmd + [")).toBeInTheDocument()
    fireEvent.keyUp(textbox2, { key: "[", code: "BracketLeft" })
    fireEvent.keyUp(textbox2, { key: "Control", code: "ControlRight" })
    expect(onGlobalShortcutChange).toHaveBeenLastCalledWith("CommandOrControl+BracketLeft")
  })

  it("records arrow and page keys through the Tauri mapping", async () => {
    const { onGlobalShortcutChange } = renderSection()
    const textbox = await startRecording()

    fireEvent.keyDown(textbox, { key: "Alt", code: "AltRight" })
    fireEvent.keyDown(textbox, { key: "ArrowUp", code: "ArrowUp" })
    expect(screen.getByText("Opt + Up")).toBeInTheDocument()
    fireEvent.keyUp(textbox, { key: "ArrowUp", code: "ArrowUp" })
    fireEvent.keyUp(textbox, { key: "Alt", code: "AltRight" })
    expect(onGlobalShortcutChange).toHaveBeenLastCalledWith("Alt+Up")
  })

  it("deduplicates repeated Alt and Shift modifiers", async () => {
    const { onGlobalShortcutChange } = renderSection()
    const textbox = await startRecording()

    fireEvent.keyDown(textbox, { key: "Alt", code: "AltLeft" })
    fireEvent.keyDown(textbox, { key: "Alt", code: "AltRight" })
    fireEvent.keyDown(textbox, { key: "Shift", code: "ShiftLeft" })
    fireEvent.keyDown(textbox, { key: "Shift", code: "ShiftRight" })
    fireEvent.keyDown(textbox, { key: "K", code: "KeyK" })
    expect(screen.getByText("Opt + Shift + K")).toBeInTheDocument()

    fireEvent.keyUp(textbox, { key: "K", code: "KeyK" })
    fireEvent.keyUp(textbox, { key: "Shift", code: "ShiftRight" })
    fireEvent.keyUp(textbox, { key: "Shift", code: "ShiftLeft" })
    fireEvent.keyUp(textbox, { key: "Alt", code: "AltRight" })
    fireEvent.keyUp(textbox, { key: "Alt", code: "AltLeft" })

    expect(onGlobalShortcutChange).toHaveBeenCalledWith("Alt+Shift+K")
  })

  it("ignores non-activation keys on the shortcut trigger", () => {
    renderSection()
    const trigger = screen.getByRole("button", { name: /Click to set/i })

    fireEvent.keyDown(trigger, { key: "a" })
    expect(screen.queryByRole("textbox", { name: /Press keys/i })).toBeNull()
  })

  it("records and saves CommandOrControl + Shift + key", async () => {
    const { onGlobalShortcutChange } = renderSection()
    const textbox = await startRecording()

    fireEvent.keyDown(textbox, { key: "Meta", code: "MetaLeft" })
    fireEvent.keyDown(textbox, { key: "Shift", code: "ShiftLeft" })
    fireEvent.keyDown(textbox, { key: "U", code: "KeyU" })
    expect(screen.getByText("Cmd + Shift + U")).toBeInTheDocument()

    fireEvent.keyUp(textbox, { key: "U", code: "KeyU" })
    fireEvent.keyUp(textbox, { key: "Shift", code: "ShiftLeft" })
    fireEvent.keyUp(textbox, { key: "Meta", code: "MetaLeft" })

    expect(onGlobalShortcutChange).toHaveBeenCalledWith("CommandOrControl+Shift+U")
    expect(screen.queryByRole("textbox", { name: /Press keys/i })).toBeNull()
  })

  it("maps Enter to Return and Numpad keys for display", async () => {
    const { onGlobalShortcutChange } = renderSection()
    const textbox = await startRecording()

    fireEvent.keyDown(textbox, { key: "Meta", code: "MetaLeft" })
    fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" })
    expect(screen.getByText("Cmd + Enter")).toBeInTheDocument()
    fireEvent.keyUp(textbox, { key: "Enter", code: "Enter" })
    fireEvent.keyUp(textbox, { key: "Meta", code: "MetaLeft" })
    expect(onGlobalShortcutChange).toHaveBeenLastCalledWith("CommandOrControl+Return")

    const textbox2 = await startRecording()
    fireEvent.keyDown(textbox2, { key: "Meta", code: "MetaLeft" })
    fireEvent.keyDown(textbox2, { key: "1", code: "Numpad1" })
    expect(screen.getByText("Cmd + Num1")).toBeInTheDocument()
    fireEvent.keyUp(textbox2, { key: "1", code: "Numpad1" })
    fireEvent.keyUp(textbox2, { key: "Meta", code: "MetaLeft" })
    expect(onGlobalShortcutChange).toHaveBeenLastCalledWith("CommandOrControl+Numpad1")
  })

  it("deduplicates Meta + Control into one CommandOrControl modifier", async () => {
    const { onGlobalShortcutChange } = renderSection()
    const textbox = await startRecording()

    fireEvent.keyDown(textbox, { key: "Meta", code: "MetaLeft" })
    fireEvent.keyDown(textbox, { key: "Control", code: "ControlLeft" })
    fireEvent.keyDown(textbox, { key: "A", code: "KeyA" })
    expect(screen.getByText("Cmd + A")).toBeInTheDocument()

    fireEvent.keyUp(textbox, { key: "A", code: "KeyA" })
    fireEvent.keyUp(textbox, { key: "Control", code: "ControlLeft" })
    fireEvent.keyUp(textbox, { key: "Meta", code: "MetaLeft" })

    expect(onGlobalShortcutChange).toHaveBeenCalledWith("CommandOrControl+A")
  })

  it("records and saves Alt shortcuts", async () => {
    const { onGlobalShortcutChange } = renderSection()
    const textbox = await startRecording()

    fireEvent.keyDown(textbox, { key: "Alt", code: "AltLeft" })
    fireEvent.keyDown(textbox, { key: "/", code: "Slash" })
    expect(screen.getByText("Opt + /")).toBeInTheDocument()

    fireEvent.keyUp(textbox, { key: "/", code: "Slash" })
    fireEvent.keyUp(textbox, { key: "Alt", code: "AltLeft" })

    expect(onGlobalShortcutChange).toHaveBeenCalledWith("Alt+Slash")
  })

  it("does not save when only modifiers are pressed", async () => {
    const { onGlobalShortcutChange } = renderSection()
    const textbox = await startRecording()

    fireEvent.keyDown(textbox, { key: "Meta", code: "MetaLeft" })
    fireEvent.keyUp(textbox, { key: "Meta", code: "MetaLeft" })

    expect(onGlobalShortcutChange).not.toHaveBeenCalled()
    expect(screen.getByRole("textbox", { name: /Press keys/i })).toBeInTheDocument()
  })

  it("clears and exits recording on Escape", async () => {
    const { onGlobalShortcutChange } = renderSection("CommandOrControl+Shift+U")
    const trigger = screen.getByRole("button", { name: /Cmd \+ Shift \+ U/i })
    await userEvent.click(trigger)

    const textbox = screen.getByRole("textbox", { name: /Press keys/i })
    fireEvent.keyDown(textbox, { key: "Escape", code: "Escape" })

    expect(onGlobalShortcutChange).toHaveBeenCalledWith(null)
    expect(screen.queryByRole("textbox", { name: /Press keys/i })).toBeNull()
  })

  it("clears existing shortcut from clear button without starting recording", async () => {
    const { onGlobalShortcutChange } = renderSection("CommandOrControl+Shift+U")
    await userEvent.click(screen.getByRole("button", { name: /Clear shortcut/i }))

    expect(onGlobalShortcutChange).toHaveBeenCalledWith(null)
    expect(screen.queryByRole("textbox", { name: /Press keys/i })).toBeNull()
  })

  it("starts recording from keyboard activation keys", () => {
    renderSection()
    const trigger = screen.getByRole("button", { name: /Click to set/i })

    fireEvent.keyDown(trigger, { key: "Enter" })
    expect(screen.getByRole("textbox", { name: /Press keys/i })).toBeInTheDocument()

    fireEvent.blur(screen.getByRole("textbox", { name: /Press keys/i }))
    expect(screen.queryByRole("textbox", { name: /Press keys/i })).toBeNull()

    fireEvent.keyDown(trigger, { key: " " })
    expect(screen.getByRole("textbox", { name: /Press keys/i })).toBeInTheDocument()
  })

  it("focuses the recording textbox after starting", async () => {
    vi.useFakeTimers()
    renderSection()

    fireEvent.click(screen.getByRole("button", { name: /Click to set/i }))
    const textbox = screen.getByRole("textbox", { name: /Press keys/i })

    await act(async () => {
      vi.advanceTimersByTime(10)
    })

    expect(textbox).toHaveFocus()
  })

  it("cancels recording on blur without saving pending shortcut", async () => {
    const { onGlobalShortcutChange } = renderSection()
    const textbox = await startRecording()

    fireEvent.keyDown(textbox, { key: "Meta", code: "MetaLeft" })
    fireEvent.keyDown(textbox, { key: "Q", code: "KeyQ" })
    expect(screen.getByText("Cmd + Q")).toBeInTheDocument()

    fireEvent.blur(textbox)
    expect(onGlobalShortcutChange).not.toHaveBeenCalled()
    expect(screen.queryByRole("textbox", { name: /Press keys/i })).toBeNull()
  })
})
