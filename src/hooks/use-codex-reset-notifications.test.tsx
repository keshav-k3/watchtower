import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MetricLine } from "@/lib/plugin-types"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

const {
  loadSnapshotMock,
  saveSnapshotMock,
  isPermissionGrantedMock,
  requestPermissionMock,
  sendNotificationMock,
} = vi.hoisted(() => ({
  loadSnapshotMock: vi.fn(),
  saveSnapshotMock: vi.fn(),
  isPermissionGrantedMock: vi.fn(),
  requestPermissionMock: vi.fn(),
  sendNotificationMock: vi.fn(),
}))

vi.mock("@/lib/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings")>()
  return {
    ...actual,
    loadCodexResetSnapshot: loadSnapshotMock,
    saveCodexResetSnapshot: saveSnapshotMock,
  }
})

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: isPermissionGrantedMock,
  requestPermission: requestPermissionMock,
  sendNotification: sendNotificationMock,
}))

import { useCodexResetNotifications } from "@/hooks/use-codex-reset-notifications"

const high: MetricLine = {
  type: "progress",
  label: "Session",
  used: 80,
  limit: 100,
  format: { kind: "percent" },
  resetsAt: "2026-10-26T18:00:00.000Z",
}

const reset: MetricLine = {
  type: "progress",
  label: "Session",
  used: 2,
  limit: 100,
  format: { kind: "percent" },
  resetsAt: "2026-10-26T12:00:00.000Z",
}

function Harness({ lines }: { lines: MetricLine[] | null }) {
  return useCodexResetNotifications(lines)
}

describe("useCodexResetNotifications", () => {
  beforeEach(() => {
    loadSnapshotMock.mockReset()
    saveSnapshotMock.mockReset()
    isPermissionGrantedMock.mockReset()
    requestPermissionMock.mockReset()
    sendNotificationMock.mockReset()
    loadSnapshotMock.mockResolvedValue(null)
    saveSnapshotMock.mockResolvedValue(undefined)
    isPermissionGrantedMock.mockResolvedValue(true)
    useAppPreferencesStore.getState().resetState()
  })

  it("shows a banner and a native notification when limits reset", async () => {
    const { rerender } = render(<Harness lines={[high]} />)
    await waitFor(() => expect(saveSnapshotMock).toHaveBeenCalled())
    rerender(<Harness lines={[reset]} />)
    expect(await screen.findByRole("status")).toHaveTextContent("Codex limits were reset")
    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "Codex Limits Were Reset",
      body: "Codex limits were reset",
    })
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("asks for permission when it has not been granted", async () => {
    isPermissionGrantedMock.mockResolvedValue(false)
    requestPermissionMock.mockResolvedValue("granted")
    loadSnapshotMock.mockResolvedValue([
      {
        account: "Codex",
        kind: "session",
        usedPercent: 80,
        resetAtMs: Date.parse("2026-10-26T18:00:00.000Z"),
      },
    ])
    render(<Harness lines={[reset]} />)
    expect(await screen.findByRole("status")).toBeInTheDocument()
    expect(requestPermissionMock).toHaveBeenCalled()
    expect(sendNotificationMock).toHaveBeenCalled()
  })

  it("logs a denied permission and a send failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    isPermissionGrantedMock.mockResolvedValue(false)
    requestPermissionMock.mockResolvedValue("denied")
    loadSnapshotMock.mockResolvedValue([
      {
        account: "Codex",
        kind: "session",
        usedPercent: 80,
        resetAtMs: Date.parse("2026-10-26T18:00:00.000Z"),
      },
    ])
    const { unmount } = render(<Harness lines={[reset]} />)
    await screen.findByRole("status")
    expect(consoleSpy).toHaveBeenCalledWith("Codex reset notification permission was denied")
    unmount()

    sendNotificationMock.mockImplementation(() => {
      throw new Error("nope")
    })
    isPermissionGrantedMock.mockResolvedValue(true)
    render(<Harness lines={[reset]} />)
    await screen.findByRole("status")
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to send Codex reset notification:",
      expect.any(Error),
    )
    consoleSpy.mockRestore()
  })

  it("does not notify when the toggle is off, and logs history failures", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    useAppPreferencesStore.getState().setCodexResetNotifications(false)
    loadSnapshotMock.mockRejectedValueOnce(new Error("load"))
    saveSnapshotMock.mockRejectedValueOnce(new Error("save"))
    render(<Harness lines={[high]} />)
    await vi.waitFor(() => {
      expect(saveSnapshotMock).toHaveBeenCalled()
    })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it("ignores a history failure that finishes after unmount", async () => {
    let rejectLoad: (error: Error) => void = () => {}
    loadSnapshotMock.mockReturnValue(new Promise((_resolve, reject) => {
      rejectLoad = reject
    }))
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { unmount } = render(<Harness lines={null} />)
    unmount()
    await act(async () => {
      rejectLoad(new Error("late"))
      await Promise.resolve()
    })
    expect(saveSnapshotMock).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it("ignores a history load that finishes after unmount", async () => {
    let resolveLoad: (value: null) => void = () => {}
    loadSnapshotMock.mockReturnValue(new Promise((resolve) => {
      resolveLoad = resolve
    }))
    const { unmount } = render(<Harness lines={null} />)
    unmount()
    await act(async () => {
      resolveLoad(null)
      await Promise.resolve()
    })
    expect(saveSnapshotMock).not.toHaveBeenCalled()
  })
})
