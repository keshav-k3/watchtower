import { beforeEach, describe, expect, it, vi } from "vitest"

const { isPermissionGrantedMock, requestPermissionMock, sendNotificationMock } = vi.hoisted(() => ({
  isPermissionGrantedMock: vi.fn(),
  requestPermissionMock: vi.fn(),
  sendNotificationMock: vi.fn(),
}))

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: isPermissionGrantedMock,
  requestPermission: requestPermissionMock,
  sendNotification: sendNotificationMock,
}))

import { sendNativeNotification } from "@/lib/notify"

describe("sendNativeNotification", () => {
  beforeEach(() => {
    isPermissionGrantedMock.mockResolvedValue(true)
  })

  it("sends with the title and body", async () => {
    await sendNativeNotification("Codex Is Running Low", "8% left on Session.")
    expect(sendNotificationMock).toHaveBeenCalledWith({ title: "Codex Is Running Low", body: "8% left on Session." })
  })

  it("asks for permission first and sends once granted", async () => {
    isPermissionGrantedMock.mockResolvedValue(false)
    requestPermissionMock.mockResolvedValue("granted")
    await sendNativeNotification("T", "B")
    expect(requestPermissionMock).toHaveBeenCalled()
    expect(sendNotificationMock).toHaveBeenCalled()
  })

  it("logs a denied permission and a failed send", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    isPermissionGrantedMock.mockResolvedValue(false)
    requestPermissionMock.mockResolvedValue("denied")
    await sendNativeNotification("T", "B")
    expect(sendNotificationMock).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith("Notification permission was denied: T")

    isPermissionGrantedMock.mockResolvedValue(true)
    sendNotificationMock.mockImplementation(() => {
      throw new Error("nope")
    })
    await sendNativeNotification("T", "B")
    expect(consoleSpy).toHaveBeenCalledWith("Failed to send notification: T", expect.any(Error))
    consoleSpy.mockRestore()
  })
})
