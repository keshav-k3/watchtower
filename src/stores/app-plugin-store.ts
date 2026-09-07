import { create } from "zustand"
import type { PluginMeta } from "@/lib/plugin-types"
import type { ProviderHome } from "@/lib/provider-homes"
import type { PluginSettings } from "@/lib/settings"

type AppPluginStore = {
  pluginsMeta: PluginMeta[]
  pluginSettings: PluginSettings | null
  providerHomes: ProviderHome[]
  setPluginsMeta: (value: PluginMeta[]) => void
  setPluginSettings: (value: PluginSettings | null) => void
  setProviderHomes: (value: ProviderHome[]) => void
  resetState: () => void
}

const initialState = {
  pluginsMeta: [] as PluginMeta[],
  pluginSettings: null as PluginSettings | null,
  providerHomes: [] as ProviderHome[],
}

export const useAppPluginStore = create<AppPluginStore>((set) => ({
  ...initialState,
  setPluginsMeta: (value) => set({ pluginsMeta: value }),
  setPluginSettings: (value) => set({ pluginSettings: value }),
  setProviderHomes: (value) => set({ providerHomes: value }),
  resetState: () => set(initialState),
}))
