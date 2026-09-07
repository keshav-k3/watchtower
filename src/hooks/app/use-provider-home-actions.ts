import { useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { PluginMeta } from "@/lib/plugin-types"
import {
  makeProviderHomeId,
  type HomeCapablePluginId,
  type ProviderHome,
} from "@/lib/provider-homes"
import {
  normalizePluginSettings,
  savePluginSettings,
  saveProviderHomes,
  type PluginSettings,
} from "@/lib/settings"

type UseProviderHomeActionsArgs = {
  pluginsMeta: PluginMeta[]
  pluginSettings: PluginSettings | null
  providerHomes: ProviderHome[]
  activeView: string
  setPluginsMeta: (value: PluginMeta[]) => void
  setPluginSettings: (value: PluginSettings | null) => void
  setProviderHomes: (value: ProviderHome[]) => void
  setActiveView: (view: "home" | "settings" | string) => void
  setLoadingForPlugins: (ids: string[]) => void
  startBatch: (pluginIds?: string[]) => Promise<string[] | undefined>
}

async function reloadPluginsMeta(): Promise<PluginMeta[]> {
  return invoke<PluginMeta[]>("list_plugins")
}

export function useProviderHomeActions({
  pluginsMeta,
  pluginSettings,
  providerHomes,
  activeView,
  setPluginsMeta,
  setPluginSettings,
  setProviderHomes,
  setActiveView,
  setLoadingForPlugins,
  startBatch,
}: UseProviderHomeActionsArgs) {
  const persistHomesAndPlugins = useCallback(
    async (nextHomes: ProviderHome[], extraOrderIds: string[] = []) => {
      await saveProviderHomes(nextHomes)
      setProviderHomes(nextHomes)
      const availablePlugins = await reloadPluginsMeta()
      setPluginsMeta(availablePlugins)
      if (!pluginSettings) return availablePlugins

      const nextSettings = normalizePluginSettings(
        {
          order: [...pluginSettings.order, ...extraOrderIds],
          disabled: pluginSettings.disabled.filter((id) =>
            availablePlugins.some((plugin) => plugin.id === id)
          ),
        },
        availablePlugins
      )
      setPluginSettings(nextSettings)
      await savePluginSettings(nextSettings)
      return availablePlugins
    },
    [pluginSettings, setPluginSettings, setPluginsMeta, setProviderHomes]
  )

  const handleAddProviderHome = useCallback(
    (draft: { pluginId: HomeCapablePluginId; name: string; homePath: string }) => {
      const usedIds = [
        ...pluginsMeta.map((plugin) => plugin.id),
        ...providerHomes.map((home) => home.id),
      ]
      const home: ProviderHome = {
        id: makeProviderHomeId({
          pluginId: draft.pluginId,
          name: draft.name,
          usedIds,
        }),
        pluginId: draft.pluginId,
        name: draft.name,
        homePath: draft.homePath,
      }
      const nextHomes = [...providerHomes, home]
      void persistHomesAndPlugins(nextHomes, [home.id])
        .then(() => {
          setLoadingForPlugins([home.id])
          return startBatch([home.id])
        })
        .catch((error) => {
          console.error("Failed to add extra account:", error)
        })
    },
    [persistHomesAndPlugins, pluginsMeta, providerHomes, setLoadingForPlugins, startBatch]
  )

  const handleRemoveProviderHome = useCallback(
    (id: string) => {
      const nextHomes = providerHomes.filter((home) => home.id !== id)
      if (activeView === id) {
        setActiveView("home")
      }
      void persistHomesAndPlugins(nextHomes).catch((error) => {
        console.error("Failed to remove extra account:", error)
      })
    },
    [activeView, persistHomesAndPlugins, providerHomes, setActiveView]
  )

  return {
    handleAddProviderHome,
    handleRemoveProviderHome,
  }
}
