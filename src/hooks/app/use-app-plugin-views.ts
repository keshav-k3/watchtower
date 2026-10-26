import { useMemo, useRef, useEffect } from "react"
import type { ActiveView, NavPlugin } from "@/components/side-nav"
import type { PluginMeta } from "@/lib/plugin-types"
import type { PluginSettings } from "@/lib/settings"
import type { PluginState } from "@/hooks/app/types"

export type DisplayPluginState = { meta: PluginMeta } & PluginState

const EMPTY_PLUGIN_STATE: PluginState = {
  data: null,
  loading: false,
  error: null,
  lastManualRefreshAt: null,
  lastUpdatedAt: null,
}

function sameDisplayPlugin(
  previous: DisplayPluginState,
  meta: PluginMeta,
  state: PluginState
): boolean {
  return (
    previous.meta === meta &&
    previous.data === state.data &&
    previous.loading === state.loading &&
    previous.error === state.error &&
    previous.lastManualRefreshAt === state.lastManualRefreshAt &&
    previous.lastUpdatedAt === state.lastUpdatedAt
  )
}

type UseAppPluginViewsArgs = {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
  pluginSettings: PluginSettings | null
  pluginsMeta: PluginMeta[]
  pluginStates: Record<string, PluginState>
}

export function useAppPluginViews({
  activeView,
  setActiveView,
  pluginSettings,
  pluginsMeta,
  pluginStates,
}: UseAppPluginViewsArgs) {
  const displayCacheRef = useRef(new Map<string, DisplayPluginState>())
  const displayPlugins = useMemo<DisplayPluginState[]>(() => {
    if (!pluginSettings) {
      displayCacheRef.current.clear()
      return []
    }
    const metaById = new Map(pluginsMeta.map((plugin) => [plugin.id, plugin]))
    const disabled = new Set(pluginSettings.disabled)
    const nextCache = new Map<string, DisplayPluginState>()

    const plugins = pluginSettings.order
      .filter((id) => !disabled.has(id))
      .map((id) => {
        const meta = metaById.get(id)
        if (!meta) return null
        const state = pluginStates[id] ?? EMPTY_PLUGIN_STATE
        const previous = displayCacheRef.current.get(id)
        const display = previous && sameDisplayPlugin(previous, meta, state)
          ? previous
          : { meta, ...state }
        nextCache.set(id, display)
        return display
      })
      .filter((plugin): plugin is DisplayPluginState => Boolean(plugin))

    displayCacheRef.current = nextCache
    return plugins
  }, [pluginSettings, pluginStates, pluginsMeta])

  const navPlugins = useMemo<NavPlugin[]>(() => {
    if (!pluginSettings) return []
    const metaById = new Map(pluginsMeta.map((plugin) => [plugin.id, plugin]))
    const disabled = new Set(pluginSettings.disabled)

    return pluginSettings.order
      .filter((id) => !disabled.has(id))
      .map((id) => metaById.get(id))
      .filter((plugin): plugin is PluginMeta => Boolean(plugin))
      .map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        iconUrl: plugin.iconUrl,
        brandColor: plugin.brandColor,
      }))
  }, [pluginSettings, pluginsMeta])

  useEffect(() => {
    if (activeView === "home" || activeView === "settings") return
    if (!pluginSettings) return
    const isKnownPlugin = pluginsMeta.some((plugin) => plugin.id === activeView)
    if (!isKnownPlugin) return
    const isStillEnabled = navPlugins.some((plugin) => plugin.id === activeView)
    if (!isStillEnabled) {
      setActiveView("home")
    }
  }, [activeView, navPlugins, pluginSettings, pluginsMeta, setActiveView])

  const selectedPlugin = useMemo(() => {
    if (activeView === "home" || activeView === "settings") return null
    return displayPlugins.find((plugin) => plugin.meta.id === activeView) ?? null
  }, [activeView, displayPlugins])

  return {
    displayPlugins,
    navPlugins,
    selectedPlugin,
  }
}
