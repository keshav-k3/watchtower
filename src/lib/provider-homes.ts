export const HOME_CAPABLE_PLUGIN_IDS = ["claude", "codex"] as const

export type HomeCapablePluginId = (typeof HOME_CAPABLE_PLUGIN_IDS)[number]

export type ProviderHome = {
  id: string
  pluginId: HomeCapablePluginId
  name: string
  homePath: string
}

export function isHomeCapablePluginId(value: string): value is HomeCapablePluginId {
  return (HOME_CAPABLE_PLUGIN_IDS as readonly string[]).includes(value)
}

export function homeEnvVar(pluginId: HomeCapablePluginId): "CLAUDE_CONFIG_DIR" | "CODEX_HOME" {
  return pluginId === "claude" ? "CLAUDE_CONFIG_DIR" : "CODEX_HOME"
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
}

export function makeProviderHomeId(args: {
  pluginId: HomeCapablePluginId
  name: string
  usedIds: Iterable<string>
}): string {
  const used = new Set(args.usedIds)
  const slug = slugify(args.name) || "account"
  const base =
    slug === args.pluginId || slug.startsWith(`${args.pluginId}-`)
      ? slug === args.pluginId
        ? `${args.pluginId}-account`
        : slug
      : `${args.pluginId}-${slug}`

  if (!used.has(base) && !isHomeCapablePluginId(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`) || isHomeCapablePluginId(`${base}-${n}`)) {
    n += 1
  }
  return `${base}-${n}`
}

export function parseProviderHomes(value: unknown): ProviderHome[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: ProviderHome[] = []
  for (const row of value) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const id = typeof record.id === "string" ? record.id.trim() : ""
    const pluginId = typeof record.pluginId === "string" ? record.pluginId.trim() : ""
    const name = typeof record.name === "string" ? record.name.trim() : ""
    const homePath = typeof record.homePath === "string" ? record.homePath.trim() : ""
    if (!id || !name || !homePath) continue
    if (!isHomeCapablePluginId(pluginId)) continue
    if (isHomeCapablePluginId(id)) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, pluginId, name, homePath })
  }
  return out
}

export function extraIdsAfterParent(args: {
  parentId: string
  extras: ProviderHome[]
  preferredOrder: string[]
}): string[] {
  const extrasForParent = args.extras.filter((home) => home.pluginId === args.parentId)
  const preferredIndex = new Map(args.preferredOrder.map((id, index) => [id, index]))
  return extrasForParent
    .slice()
    .sort((a, b) => {
      const aIndex = preferredIndex.get(a.id)
      const bIndex = preferredIndex.get(b.id)
      if (aIndex == null && bIndex == null) return 0
      if (aIndex == null) return 1
      if (bIndex == null) return -1
      return aIndex - bIndex
    })
    .map((home) => home.id)
}
