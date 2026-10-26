import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ListeningPort } from "@/pages/ports"

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}))

import { PortsPage } from "@/pages/ports"

const nodePort: ListeningPort = {
  port: 3000,
  pid: 42,
  processName: "node",
  user: "keshav",
  cwd: "/Users/keshav/demo",
  project: "demo",
  system: false,
  selfProcess: false,
}

const systemPort: ListeningPort = {
  port: 22,
  pid: 1,
  processName: "launchd",
  user: "root",
  cwd: null,
  project: null,
  system: true,
  selfProcess: false,
}

const selfPort: ListeningPort = {
  port: 1420,
  pid: 7,
  processName: "watchtower",
  user: "keshav",
  cwd: "/Applications/Watchtower.app",
  project: null,
  system: false,
  selfProcess: true,
}

describe("PortsPage", () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue({ supported: true, note: null, ports: [systemPort, nodePort, selfPort] })
  })

  it("lists user ports, reveals system ports, and stops a process", async () => {
    render(<PortsPage />)
    expect(await screen.findByText("3000")).toBeInTheDocument()
    expect(screen.getByText("demo · /Users/keshav/demo")).toBeInTheDocument()
    expect(screen.getByText("Watchtower")).toBeInTheDocument()
    expect(screen.queryByText("22")).not.toBeInTheDocument()

    const systemSwitch = screen.getByRole("switch", { name: "Show System" })
    await userEvent.click(systemSwitch)
    expect(screen.getByText("22")).toBeInTheDocument()
    expect(screen.getByText("System")).toBeInTheDocument()
    expect(screen.getByText("Working directory unavailable")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Show System" })).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByRole("switch", { name: "Show System" }))
    expect(screen.queryByText("22")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Stop" }))
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(invokeMock).not.toHaveBeenCalledWith("stop_listening_process", expect.anything())

    await userEvent.click(screen.getByRole("button", { name: "Stop" }))
    invokeMock.mockResolvedValueOnce(undefined)
    const dialog = screen.getByRole("dialog", { name: "Stop Process" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Stop" }))
    expect(invokeMock).toHaveBeenCalledWith("stop_listening_process", { pid: 42, force: false })

    const forceButton = await screen.findByRole("button", { name: "Force Stop" })
    await userEvent.click(forceButton)
    invokeMock.mockResolvedValueOnce(undefined)
    await userEvent.click(within(screen.getByRole("dialog", { name: "Stop Process" })).getByRole("button", { name: "Force Stop" }))
    expect(invokeMock).toHaveBeenCalledWith("stop_listening_process", { pid: 42, force: true })
  })

  it("refreshes while the view is open", async () => {
    vi.useFakeTimers()
    render(<PortsPage />)
    await act(async () => {
      await Promise.resolve()
    })
    const before = invokeMock.mock.calls.length
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(invokeMock.mock.calls.length).toBeGreaterThan(before)
    vi.useRealTimers()
  })

  it("shows an empty state, an unsupported note, and errors", async () => {
    invokeMock.mockResolvedValueOnce({ supported: false, note: "lsof is not installed.", ports: [] })
    const { unmount } = render(<PortsPage />)
    expect(await screen.findByText("lsof is not installed.")).toBeInTheDocument()
    expect(screen.getByText("No Listening Ports")).toBeInTheDocument()
    unmount()

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    invokeMock.mockRejectedValueOnce(new Error("list failed"))
    render(<PortsPage />)
    expect(await screen.findByText("Listening ports could not be loaded.")).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it("shows the message from a failed stop", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "stop_listening_process") throw new Error("nope")
      return { supported: true, note: null, ports: [nodePort] }
    })
    render(<PortsPage />)
    await screen.findByText("3000")
    await userEvent.click(screen.getByRole("button", { name: "Stop" }))
    await userEvent.click(within(screen.getByRole("dialog", { name: "Stop Process" })).getByRole("button", { name: "Stop" }))
    expect(await screen.findByText("nope")).toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it("shows a non-error stop failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "stop_listening_process") throw "busy"
      return { supported: true, note: null, ports: [nodePort] }
    })
    render(<PortsPage />)
    await screen.findByText("3000")
    await userEvent.click(screen.getByRole("button", { name: "Stop" }))
    await userEvent.click(within(screen.getByRole("dialog", { name: "Stop Process" })).getByRole("button", { name: "Stop" }))
    expect(await screen.findByText("busy")).toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it("disables the dialog while a stop is in flight", async () => {
    let resolveStop: () => void = () => {}
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "stop_listening_process") {
        return new Promise<void>((resolve) => {
          resolveStop = resolve
        })
      }
      return { supported: true, note: null, ports: [nodePort] }
    })
    render(<PortsPage />)
    await screen.findByText("3000")
    await userEvent.click(screen.getByRole("button", { name: "Stop" }))
    const dialog = screen.getByRole("dialog", { name: "Stop Process" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Stop" }))
    expect(await within(dialog).findByRole("button", { name: "Stopping…" })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    await act(async () => {
      resolveStop()
      await Promise.resolve()
    })
    expect(await screen.findByRole("button", { name: "Force Stop" })).toBeInTheDocument()
  })
})
