import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

const { saveMock } = vi.hoisted(() => ({ saveMock: vi.fn() }))

vi.mock("@/lib/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings")>()
  return { ...actual, saveLowUsageAlerts: saveMock }
})

import { LowUsageAlertsSection } from "@/components/low-usage-alerts-section"

describe("LowUsageAlertsSection", () => {
  beforeEach(() => {
    useAppPreferencesStore.getState().resetState()
    saveMock.mockResolvedValue(undefined)
  })

  it("is off by default with 10% picked and the threshold locked", () => {
    render(<LowUsageAlertsSection />)
    expect(screen.getByRole("switch", { name: "Notify When Low" })).not.toBeChecked()
    const ten = screen.getByRole("button", { name: "10%" })
    expect(ten).toHaveAttribute("aria-pressed", "true")
    expect(ten).toBeDisabled()
  })

  it("turns alerts on, picks a threshold, and saves both", async () => {
    render(<LowUsageAlertsSection />)
    await userEvent.click(screen.getByRole("switch", { name: "Notify When Low" }))
    expect(saveMock).toHaveBeenLastCalledWith({ enabled: true, thresholdPercent: 10 })

    await userEvent.click(screen.getByRole("button", { name: "20%" }))
    expect(saveMock).toHaveBeenLastCalledWith({ enabled: true, thresholdPercent: 20 })
    expect(screen.getByRole("button", { name: "20%" })).toHaveAttribute("aria-pressed", "true")
    expect(useAppPreferencesStore.getState().lowUsageAlerts).toEqual({ enabled: true, thresholdPercent: 20 })
  })

  it("logs a failed save", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    saveMock.mockRejectedValue(new Error("disk"))
    render(<LowUsageAlertsSection />)
    await userEvent.click(screen.getByRole("switch", { name: "Notify When Low" }))
    await waitFor(() =>
      expect(consoleSpy).toHaveBeenCalledWith("Failed to save low usage alerts:", expect.any(Error))
    )
    consoleSpy.mockRestore()
  })
})
