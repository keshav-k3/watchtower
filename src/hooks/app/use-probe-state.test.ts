import { renderHook, act } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { PluginOutput } from "@/lib/plugin-types"
import { useProbeState } from "@/hooks/app/use-probe-state"

function createOutput(overrides: Partial<PluginOutput> = {}): PluginOutput {
  return {
    providerId: "codex",
    displayName: "Codex",
    iconUrl: "/codex.svg",
    lines: [],
    ...overrides,
  }
}

describe("useProbeState", () => {
  it("updates pluginStatesRef synchronously when marking plugins loading", () => {
    const { result } = renderHook(() => useProbeState({}))

    let loadingImmediatelyAfterSet: boolean | undefined
    act(() => {
      result.current.setLoadingForPlugins(["codex"])
      loadingImmediatelyAfterSet =
        result.current.pluginStatesRef.current.codex?.loading
    })

    expect(loadingImmediatelyAfterSet).toBe(true)
    expect(result.current.pluginStates.codex?.loading).toBe(true)
  })

  it("sets plugin errors for plugins without existing state", () => {
    const { result } = renderHook(() => useProbeState({}))

    act(() => {
      result.current.setErrorForPlugins(["codex"], "Network failed")
    })

    expect(result.current.pluginStates.codex).toMatchObject({
      data: null,
      loading: false,
      error: "Network failed",
      lastManualRefreshAt: null,
      lastUpdatedAt: null,
    })
  })

  it("sets plugin errors while preserving existing data", () => {
    const existingOutput = createOutput()
    const { result } = renderHook(() => useProbeState({}))

    act(() => {
      result.current.handleProbeResult(existingOutput)
      result.current.setErrorForPlugins(["codex"], "Network failed")
    })

    expect(result.current.pluginStates.codex).toMatchObject({
      data: existingOutput,
      loading: false,
      error: "Network failed",
    })
  })

  it("stores error badge output without replacing existing data", () => {
    const existingOutput = createOutput({ lines: [{ type: "text", label: "Usage", value: "50%" }] })
    const { result } = renderHook(() => useProbeState({}))

    act(() => {
      result.current.handleProbeResult(existingOutput)
      result.current.handleProbeResult(
        createOutput({
          lines: [{ type: "badge", label: "Error", text: "Token expired" }],
        })
      )
    })

    expect(result.current.pluginStates.codex).toMatchObject({
      data: existingOutput,
      loading: false,
      error: "Token expired",
    })
  })

  it("uses a fallback error message when the badge text is empty", () => {
    const { result } = renderHook(() => useProbeState({}))

    act(() => {
      result.current.handleProbeResult(
        createOutput({
          lines: [{ type: "badge", label: "Error", text: "" }],
        })
      )
    })

    expect(result.current.pluginStates.codex?.error).toBe("Couldn't update data. Try again?")
  })

  it("records manual refresh timestamps and calls onProbeResult", () => {
    const onProbeResult = vi.fn()
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(42_000)
    const { result } = renderHook(() => useProbeState({ onProbeResult }))

    act(() => {
      result.current.manualRefreshIdsRef.current.add("codex")
      result.current.handleProbeResult(createOutput())
    })

    expect(result.current.pluginStates.codex).toMatchObject({
      loading: false,
      error: null,
      lastManualRefreshAt: 42_000,
      lastUpdatedAt: 42_000,
    })
    expect(onProbeResult).toHaveBeenCalledTimes(1)
    nowSpy.mockRestore()
  })

  it("ignores non-error badge outputs", () => {
    const { result } = renderHook(() => useProbeState({}))

    act(() => {
      result.current.handleProbeResult(
        createOutput({
          lines: [{ type: "badge", label: "Plan", text: "Pro" }],
        })
      )
    })

    expect(result.current.pluginStates.codex?.error).toBeNull()
  })
})
