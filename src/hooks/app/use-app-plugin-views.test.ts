import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useAppPluginViews } from "@/hooks/app/use-app-plugin-views"
import type { PluginMeta } from "@/lib/plugin-types"
import type { PluginSettings } from "@/lib/settings"

function createPluginMeta(id: string, name: string): PluginMeta {
  return {
    id,
    name,
    iconUrl: `/${id}.svg`,
    brandColor: "#000000",
    lines: [],
    primaryCandidates: [],
  }
}

describe("useAppPluginViews", () => {
  it("derives display and nav plugins from settings order", () => {
    const pluginSettings: PluginSettings = {
      order: ["codex", "cursor"],
      disabled: ["cursor"],
    }

    const pluginsMeta = [
      createPluginMeta("cursor", "Cursor"),
      createPluginMeta("codex", "Codex"),
    ]

    const { result } = renderHook(() =>
      useAppPluginViews({
        activeView: "home",
        setActiveView: vi.fn(),
        pluginSettings,
        pluginsMeta,
        pluginStates: {
          codex: {
            data: null,
            loading: true,
            error: null,
            lastManualRefreshAt: null,
            lastUpdatedAt: null,
          },
        },
      })
    )

    expect(result.current.displayPlugins).toHaveLength(1)
    expect(result.current.displayPlugins[0]?.meta.id).toBe("codex")
    expect(result.current.displayPlugins[0]?.loading).toBe(true)
    expect(result.current.navPlugins).toEqual([
      {
        id: "codex",
        name: "Codex",
        iconUrl: "/codex.svg",
        brandColor: "#000000",
      },
    ])
  })

  it("returns home when the active provider is hidden", () => {
    const setActiveView = vi.fn()
    const pluginSettings: PluginSettings = {
      order: ["codex"],
      disabled: ["codex"],
    }

    renderHook(() =>
      useAppPluginViews({
        activeView: "codex",
        setActiveView,
        pluginSettings,
        pluginsMeta: [createPluginMeta("codex", "Codex")],
        pluginStates: {},
      })
    )

    expect(setActiveView).toHaveBeenCalledWith("home")
  })

  it("does not fall back while plugin settings are still loading", () => {
    const setActiveView = vi.fn()
    const pluginsMeta = [createPluginMeta("codex", "Codex")]
    const { rerender } = renderHook(
      ({ pluginSettings }: { pluginSettings: PluginSettings | null }) =>
        useAppPluginViews({
          activeView: "codex",
          setActiveView,
          pluginSettings,
          pluginsMeta,
          pluginStates: {},
        }),
      { initialProps: { pluginSettings: null } }
    )

    expect(setActiveView).not.toHaveBeenCalled()

    rerender({
      pluginSettings: {
        order: [],
        disabled: ["codex"],
      },
    })

    expect(setActiveView).toHaveBeenCalledWith("home")
  })

  it("skips plugin ids missing from metadata", () => {
    const pluginSettings: PluginSettings = {
      order: ["codex", "ghost"],
      disabled: [],
    }

    const { result } = renderHook(() =>
      useAppPluginViews({
        activeView: "home",
        setActiveView: vi.fn(),
        pluginSettings,
        pluginsMeta: [createPluginMeta("codex", "Codex")],
        pluginStates: {},
      })
    )

    expect(result.current.displayPlugins).toHaveLength(1)
    expect(result.current.displayPlugins[0]?.meta.id).toBe("codex")
  })

  it("keeps active view when it is not a known plugin", () => {
    const setActiveView = vi.fn()
    const pluginSettings: PluginSettings = {
      order: ["codex"],
      disabled: [],
    }

    renderHook(() =>
      useAppPluginViews({
        activeView: "unknown",
        setActiveView,
        pluginSettings,
        pluginsMeta: [createPluginMeta("codex", "Codex")],
        pluginStates: {},
      })
    )

    expect(setActiveView).not.toHaveBeenCalled()
  })

  it("keeps settings view selected without a provider", () => {
    const setActiveView = vi.fn()
    const pluginSettings: PluginSettings = {
      order: ["codex"],
      disabled: [],
    }

    const { result } = renderHook(() =>
      useAppPluginViews({
        activeView: "settings",
        setActiveView,
        pluginSettings,
        pluginsMeta: [createPluginMeta("codex", "Codex")],
        pluginStates: {},
      })
    )

    expect(setActiveView).not.toHaveBeenCalled()
    expect(result.current.selectedPlugin).toBeNull()
  })

  it("returns selected plugin for active provider view", () => {
    const pluginSettings: PluginSettings = {
      order: ["codex"],
      disabled: [],
    }

    const { result } = renderHook(() =>
      useAppPluginViews({
        activeView: "codex",
        setActiveView: vi.fn(),
        pluginSettings,
        pluginsMeta: [createPluginMeta("codex", "Codex")],
        pluginStates: {},
      })
    )

    expect(result.current.selectedPlugin?.meta.id).toBe("codex")
  })

  it("reuses a display row when its values do not change", () => {
    const meta = createPluginMeta("codex", "Codex")
    const state = {
      data: null,
      loading: false,
      error: null,
      lastManualRefreshAt: null,
      lastUpdatedAt: null,
    }
    const pluginSettings: PluginSettings = { order: ["codex"], disabled: [] }
    const { result, rerender } = renderHook(
      ({
        states,
        settings,
        metas,
      }: {
        states: Record<string, typeof state>
        settings: PluginSettings | null
        metas: PluginMeta[]
      }) =>
        useAppPluginViews({
          activeView: "home",
          setActiveView: vi.fn(),
          pluginSettings: settings,
          pluginsMeta: metas,
          pluginStates: states,
        }),
      { initialProps: { states: { codex: state }, settings: pluginSettings, metas: [meta] } }
    )

    const first = result.current.displayPlugins[0]
    rerender({ states: { codex: { ...state } }, settings: pluginSettings, metas: [meta] })
    expect(result.current.displayPlugins[0]).toBe(first)

    rerender({ states: {}, settings: null, metas: [meta] })
    expect(result.current.displayPlugins).toEqual([])

    const changes = [
      { data: { providerId: "codex", displayName: "Codex", lines: [], iconUrl: "" } },
      { loading: true },
      { error: "offline" },
      { lastManualRefreshAt: 5 },
      { lastUpdatedAt: 6 },
    ]
    for (const patch of changes) {
      rerender({ states: { codex: state }, settings: pluginSettings, metas: [meta] })
      const baseline = result.current.displayPlugins[0]
      rerender({
        states: { codex: { ...state, ...patch } },
        settings: pluginSettings,
        metas: [meta],
      })
      expect(result.current.displayPlugins[0]).not.toBe(baseline)
    }

    rerender({ states: { codex: state }, settings: pluginSettings, metas: [meta] })
    const beforeRename = result.current.displayPlugins[0]
    rerender({
      states: { codex: state },
      settings: pluginSettings,
      metas: [createPluginMeta("codex", "Codex 2")],
    })
    expect(result.current.displayPlugins[0]?.meta.name).toBe("Codex 2")
    expect(result.current.displayPlugins[0]).not.toBe(beforeRename)
  })
})
