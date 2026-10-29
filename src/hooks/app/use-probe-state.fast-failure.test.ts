import { act, renderHook } from "@testing-library/react"
import { useEffect, useLayoutEffect, useRef } from "react"
import { describe, expect, it } from "vitest"
import type { PluginOutput } from "@/lib/plugin-types"
import { useProbeState } from "@/hooks/app/use-probe-state"

const FAST_FAILING = ["cursor", "codex", "opencode", "kimi"] as const

function failedProbe(providerId: string, message: string): PluginOutput {
  return {
    providerId,
    displayName: providerId,
    iconUrl: `/${providerId}.svg`,
    lines: [{ type: "badge", label: "Error", text: message }],
  }
}

describe("useProbeState with probes that fail immediately", () => {
  it("ends every fast-failing provider in the error state, not loading", () => {
    // Real timing on Linux: a probe that can't find credentials fails in a few
    // milliseconds, so its result lands while React is still committing the
    // render that marked it loading. Deliver one result during that commit
    // (layout effect) and the rest in the same commit's passive effects.
    const { result } = renderHook(() => {
      const state = useProbeState({})
      const delivered = useRef({ layout: false, passive: false })
      const allLoading = FAST_FAILING.every((id) => state.pluginStates[id]?.loading)

      useLayoutEffect(() => {
        if (!allLoading || delivered.current.layout) return
        delivered.current.layout = true
        state.handleProbeResult(failedProbe("cursor", "Not logged in."))
      })

      useEffect(() => {
        if (!allLoading || delivered.current.passive) return
        delivered.current.passive = true
        for (const id of FAST_FAILING.slice(1)) {
          state.handleProbeResult(failedProbe(id, `${id} not logged in.`))
        }
      })

      return state
    })

    act(() => {
      result.current.setLoadingForPlugins([...FAST_FAILING])
    })

    for (const id of FAST_FAILING) {
      expect(result.current.pluginStates[id]).toMatchObject({ loading: false })
      expect(result.current.pluginStates[id]?.error).toMatch(/not logged in/i)
      expect(result.current.pluginStatesRef.current[id]?.loading).toBe(false)
    }
  })

  it.each(FAST_FAILING)("shows %s's failure message once its probe errors", (id) => {
    const { result } = renderHook(() => useProbeState({}))

    act(() => {
      result.current.setLoadingForPlugins([id])
    })
    act(() => {
      result.current.handleProbeResult(failedProbe(id, "Not logged in."))
    })

    expect(result.current.pluginStates[id]).toMatchObject({
      loading: false,
      error: "Not logged in.",
      data: null,
    })
  })
})
