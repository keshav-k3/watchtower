import { act, render, screen, waitFor, within } from "@testing-library/react"
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
  processName: "/Applications/Watchtower.app/Contents/MacOS/watchtower",
  user: "keshav",
  cwd: "/Applications/Watchtower.app",
  project: null,
  system: false,
  selfProcess: true,
}

const nodeSecondPort: ListeningPort = { ...nodePort, port: 3001 }

const appPort: ListeningPort = {
  port: 7265,
  pid: 88,
  processName: "/Applications/Raycast.app/Contents/MacOS/Raycast",
  user: "keshav",
  cwd: "/",
  project: null,
  system: false,
  selfProcess: false,
}

const helperPort: ListeningPort = {
  ...appPort,
  port: 9222,
  pid: 99,
  processName:
    "/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper",
}

const stopDialog = () => screen.getByRole("dialog", { name: "Stop Process" })

describe("PortsPage", () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue({
      supported: true,
      note: null,
      ports: [systemPort, nodeSecondPort, nodePort, selfPort, appPort, helperPort],
    })
  })

  it("shows one row per process with its ports grouped, and reveals system ports", async () => {
    render(<PortsPage />)
    const nodeRow = await screen.findByRole("button", { name: "node details" })
    expect(within(nodeRow).getByText(":3000")).toBeInTheDocument()
    expect(within(nodeRow).getByText(":3001")).toBeInTheDocument()
    expect(within(nodeRow).getByText("PID 42")).toBeInTheDocument()
    expect(within(nodeRow).getByText("demo")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /details$/ })).toHaveLength(4)

    // App bundles show the app name; the full path stays on hover.
    const raycast = screen.getByRole("button", { name: "Raycast details" })
    expect(raycast).toHaveAttribute("title", "/Applications/Raycast.app/Contents/MacOS/Raycast")
    expect(screen.getByText("This App")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Stop Watchtower" })).not.toBeInTheDocument()
    const helper = screen.getByRole("button", { name: "Google Chrome details" })
    expect(within(helper).getByText("Google Chrome Helper")).toBeInTheDocument()
    // Same name in a different case is not repeated.
    expect(within(screen.getByRole("button", { name: "Watchtower details" })).queryByText("watchtower")).toBeNull()
    expect(screen.queryByText(":22")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("switch", { name: "Show System" }))
    expect(screen.getByText(":22")).toBeInTheDocument()
    expect(screen.getByText("System")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Show System" })).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByRole("switch", { name: "Show System" }))
    expect(screen.queryByText(":22")).not.toBeInTheDocument()
  })

  it("expands a row to show the full path, folder, and user", async () => {
    render(<PortsPage />)
    const raycast = await screen.findByRole("button", { name: "Raycast details" })
    expect(raycast).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(raycast)
    expect(raycast).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("/Applications/Raycast.app/Contents/MacOS/Raycast", { selector: "dd" })).toBeInTheDocument()
    expect(screen.getByText("Not available")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "node details" }))
    expect(raycast).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("/Users/keshav/demo")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "node details" }))
    expect(screen.queryByText("/Users/keshav/demo")).not.toBeInTheDocument()
  })

  it("asks before stopping, then offers Force Stop", async () => {
    render(<PortsPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Stop node" }))
    expect(within(stopDialog()).getByText("PID 42 · :3000, :3001")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(invokeMock).not.toHaveBeenCalledWith("stop_listening_process", expect.anything())

    await userEvent.click(screen.getByRole("button", { name: "Stop node" }))
    invokeMock.mockResolvedValueOnce(undefined)
    await userEvent.click(within(stopDialog()).getByRole("button", { name: "Stop" }))
    expect(invokeMock).toHaveBeenCalledWith("stop_listening_process", { pid: 42, force: false, expectedProcess: "node" })

    await userEvent.click(await screen.findByRole("button", { name: "Force Stop node" }))
    expect(within(stopDialog()).getByText("Force Stop node?")).toBeInTheDocument()
    invokeMock.mockResolvedValueOnce(undefined)
    await userEvent.click(within(stopDialog()).getByRole("button", { name: "Force Stop" }))
    expect(invokeMock).toHaveBeenCalledWith("stop_listening_process", { pid: 42, force: true, expectedProcess: "node" })
    expect(await screen.findByRole("button", { name: "Stop node" })).toBeInTheDocument()
  })

  it("sends the full executable path as the expected process", async () => {
    render(<PortsPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Stop Raycast" }))
    invokeMock.mockResolvedValueOnce(undefined)
    await userEvent.click(within(stopDialog()).getByRole("button", { name: "Stop" }))
    expect(invokeMock).toHaveBeenCalledWith("stop_listening_process", {
      pid: 88,
      force: false,
      expectedProcess: "/Applications/Raycast.app/Contents/MacOS/Raycast",
    })
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
    await userEvent.click(await screen.findByRole("button", { name: "Stop node" }))
    await userEvent.click(within(stopDialog()).getByRole("button", { name: "Stop" }))
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
    await userEvent.click(await screen.findByRole("button", { name: "Stop node" }))
    await userEvent.click(within(stopDialog()).getByRole("button", { name: "Stop" }))
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
    await userEvent.click(await screen.findByRole("button", { name: "Stop node" }))
    const dialog = stopDialog()
    await userEvent.click(within(dialog).getByRole("button", { name: "Stop" }))
    expect(await within(dialog).findByRole("button", { name: "Stopping…" })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    await act(async () => {
      resolveStop()
      await Promise.resolve()
    })
    expect(await screen.findByRole("button", { name: "Force Stop node" })).toBeInTheDocument()
  })

  it("forgets a SIGTERM mark once the pid leaves the list", async () => {
    let listed = [nodePort]
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "stop_listening_process") return undefined
      return { supported: true, note: null, ports: listed }
    })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<PortsPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Stop node" }))
    await userEvent.click(within(stopDialog()).getByRole("button", { name: "Stop" }))
    expect(await screen.findByRole("button", { name: "Force Stop node" })).toBeInTheDocument()

    listed = [selfPort]
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    await waitFor(() => expect(screen.queryByText(":3000")).not.toBeInTheDocument())
    listed = [nodePort]
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(await screen.findByRole("button", { name: "Stop node" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Force Stop node" })).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
