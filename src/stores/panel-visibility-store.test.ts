import { describe, expect, it } from "vitest"
import { usePanelVisibilityStore } from "@/stores/panel-visibility-store"

describe("panel visibility store", () => {
  it("starts visible and records later changes", () => {
    expect(usePanelVisibilityStore.getState().visible).toBe(true)
    usePanelVisibilityStore.getState().setVisible(false)
    expect(usePanelVisibilityStore.getState().visible).toBe(false)
    usePanelVisibilityStore.getState().setVisible(true)
    expect(usePanelVisibilityStore.getState().visible).toBe(true)
  })
})
