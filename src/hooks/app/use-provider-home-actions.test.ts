import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useProviderHomeActions } from "@/hooks/app/use-provider-home-actions"
import type { PluginMeta } from "@/lib/plugin-types"

const { invokeMock, savePluginSettingsMock, saveProviderHomesMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  savePluginSettingsMock: vi.fn(async () => undefined),
  saveProviderHomesMock: vi.fn(async () => undefined),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}))

vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings")
  return {
    ...actual,
    savePluginSettings: savePluginSettingsMock,
    saveProviderHomes: saveProviderHomesMock,
  }
})

function claudeMeta(): PluginMeta {
  return {
    id: "claude",
    name: "Claude",
    iconUrl: "/claude.svg",
    lines: [],
    primaryCandidates: [],
  }
}

describe("useProviderHomeActions", () => {
  beforeEach(() => {
    invokeMock.mockReset()
    savePluginSettingsMock.mockReset()
    saveProviderHomesMock.mockReset()
    savePluginSettingsMock.mockResolvedValue(undefined)
    saveProviderHomesMock.mockResolvedValue(undefined)
  })

  it("saves a new extra account and probes it", async () => {
    const setPluginsMeta = vi.fn()
    const setPluginSettings = vi.fn()
    const setProviderHomes = vi.fn()
    const setLoadingForPlugins = vi.fn()
    const startBatch = vi.fn().mockResolvedValue(["claude-work"])
    const extraMeta: PluginMeta = {
      id: "claude-work",
      name: "Claude Work",
      iconUrl: "/claude.svg",
      lines: [],
      primaryCandidates: [],
      sourcePluginId: "claude",
    }
    invokeMock.mockResolvedValue([claudeMeta(), extraMeta])

    const { result } = renderHook(() =>
      useProviderHomeActions({
        pluginsMeta: [claudeMeta()],
        pluginSettings: { order: ["claude"], disabled: [] },
        providerHomes: [],
        activeView: "home",
        setPluginsMeta,
        setPluginSettings,
        setProviderHomes,
        setActiveView: vi.fn(),
        setLoadingForPlugins,
        startBatch,
      })
    )

    act(() => {
      result.current.handleAddProviderHome({
        pluginId: "claude",
        name: "Claude Work",
        homePath: "~/.claude-work",
      })
    })

    await waitFor(() => {
      expect(saveProviderHomesMock).toHaveBeenCalledWith([
        {
          id: "claude-work",
          pluginId: "claude",
          name: "Claude Work",
          homePath: "~/.claude-work",
        },
      ])
      expect(startBatch).toHaveBeenCalledWith(["claude-work"])
    })
    expect(setLoadingForPlugins).toHaveBeenCalledWith(["claude-work"])
    expect(setPluginSettings).toHaveBeenCalled()
  })

  it("removes an extra account and leaves its detail view", async () => {
    const setActiveView = vi.fn()
    invokeMock.mockResolvedValue([claudeMeta()])

    const { result } = renderHook(() =>
      useProviderHomeActions({
        pluginsMeta: [
          claudeMeta(),
          {
            id: "claude-work",
            name: "Claude Work",
            iconUrl: "/claude.svg",
            lines: [],
            primaryCandidates: [],
            sourcePluginId: "claude",
          },
        ],
        pluginSettings: { order: ["claude", "claude-work"], disabled: [] },
        providerHomes: [
          {
            id: "claude-work",
            pluginId: "claude",
            name: "Claude Work",
            homePath: "~/.claude-work",
          },
        ],
        activeView: "claude-work",
        setPluginsMeta: vi.fn(),
        setPluginSettings: vi.fn(),
        setProviderHomes: vi.fn(),
        setActiveView,
        setLoadingForPlugins: vi.fn(),
        startBatch: vi.fn(),
      })
    )

    act(() => {
      result.current.handleRemoveProviderHome("claude-work")
    })

    await waitFor(() => {
      expect(saveProviderHomesMock).toHaveBeenCalledWith([])
    })
    expect(setActiveView).toHaveBeenCalledWith("home")
  })
})
