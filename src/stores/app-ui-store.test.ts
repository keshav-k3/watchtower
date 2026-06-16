import { beforeEach, describe, expect, it } from "vitest"
import { useAppUiStore } from "@/stores/app-ui-store"

describe("useAppUiStore", () => {
  beforeEach(() => {
    useAppUiStore.getState().resetState()
  })

  it("updates activeView", () => {
    useAppUiStore.getState().setActiveView("codex")
    expect(useAppUiStore.getState().activeView).toBe("codex")
  })

  it("updates showAbout", () => {
    useAppUiStore.getState().setShowAbout(true)
    expect(useAppUiStore.getState().showAbout).toBe(true)
  })

  it("resets to initial state", () => {
    useAppUiStore.getState().setActiveView("codex")
    useAppUiStore.getState().setShowAbout(true)

    useAppUiStore.getState().resetState()

    expect(useAppUiStore.getState()).toMatchObject({
      activeView: "home",
      showAbout: false,
    })
  })
})
