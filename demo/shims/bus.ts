import kiroSvg from "../../plugins/kiro/icon.svg?raw"
import kimiSvg from "../../plugins/kimi/icon.svg?raw"
import devinSvg from "../../plugins/devin/icon.svg?raw"
import grokBotSvg from "../../plugins/grok-bot/icon.svg?raw"
import codexSvg from "../../plugins/codex/icon.svg?raw"
import cursorSvg from "../../plugins/cursor/icon.svg?raw"
import claudeSvg from "../../plugins/claude/icon.svg?raw"

type Listener = (event: { payload: unknown }) => void

const listeners = new Map<string, Set<Listener>>()
const store = new Map<string, unknown>()
let codexResetSent = false

function svgUrl(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const icons = {
  kiro: svgUrl(kiroSvg),
  kimi: svgUrl(kimiSvg),
  devin: svgUrl(devinSvg),
  "grok-bot": svgUrl(grokBotSvg),
  codex: svgUrl(codexSvg),
  cursor: svgUrl(cursorSvg),
  claude: svgUrl(claudeSvg),
}

const demoParams =
  typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()

function nextThursday(): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntil = (4 - day + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntil)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function progress(label: string, used: number, resetsAt: string, periodDurationMs: number) {
  return {
    type: "progress" as const,
    label,
    used,
    limit: 100,
    format: { kind: "percent" as const },
    resetsAt,
    periodDurationMs,
  }
}

function count(label: string, used: number, limit: number) {
  return {
    type: "progress" as const,
    label,
    used,
    limit,
    format: { kind: "count" as const, suffix: "credits" },
  }
}

const later = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
const sooner = new Date(Date.now() + 30 * 60 * 1000).toISOString()

function codexOutput(reset: boolean) {
  return {
    providerId: "codex",
    displayName: "Codex",
    plan: "Work Plus · Personal Pro",
    iconUrl: icons.codex,
    lines: [
      progress(reset ? "Work · Session" : "Work · Session", reset ? 3 : 78, reset ? sooner : later, 5 * 60 * 60 * 1000),
      progress("Work · Weekly", reset ? 12 : 64, later, 7 * 24 * 60 * 60 * 1000),
      progress("Personal · Session", 18, later, 5 * 60 * 60 * 1000),
      progress("Personal · Weekly", 27, later, 7 * 24 * 60 * 60 * 1000),
    ],
  }
}

function devinOutput() {
  if (demoParams.get("error") === "devin") {
    return {
      providerId: "devin",
      displayName: "Devin",
      iconUrl: icons.devin,
      lines: [
        { type: "badge" as const, label: "Error", text: "Sign in to Devin", color: "#ef4444" },
      ],
    }
  }
  return {
    providerId: "devin",
    displayName: "Devin",
    plan: "Max",
    iconUrl: icons.devin,
    lines: [
      count("ACU", 187, 500),
      { type: "text" as const, label: "Extra usage balance", value: "$18.29" },
    ],
  }
}

function grokBotOutput() {
  const lines: Record<string, unknown>[] = [
    progress("Weekly Usage", 58, nextThursday(), 7 * 24 * 60 * 60 * 1000),
  ]
  if (demoParams.get("stale") === "grok-bot" || demoParams.get("stale") === "1") {
    lines.push({
      type: "badge",
      label: "Status",
      text: "Last read 7h ago. Open Grok Bot to refresh.",
      color: "#f59e0b",
    })
  }
  return {
    providerId: "grok-bot",
    displayName: "Grok Bot",
    plan: "SuperGrok",
    iconUrl: icons["grok-bot"],
    lines,
  }
}

const outputs = [
  {
    providerId: "kiro",
    displayName: "Kiro",
    plan: "Kiro Pro",
    iconUrl: icons.kiro,
    lines: [
      count("Credits", 120, 500),
      count("Bonus Credits", 40, 100),
      { type: "badge" as const, label: "Overages", text: "Disabled" },
    ],
  },
  {
    providerId: "kimi",
    displayName: "Kimi",
    plan: "Intermediate",
    iconUrl: icons.kimi,
    lines: [
      progress("Session", 42, later, 5 * 60 * 60 * 1000),
      progress("Monthly", 61, later, 30 * 24 * 60 * 60 * 1000),
    ],
  },
  devinOutput(),
  grokBotOutput(),
  codexOutput(false),
  demoParams.get("error") === "cursor"
    ? {
        providerId: "cursor",
        displayName: "Cursor",
        iconUrl: icons.cursor,
        lines: [
          {
            type: "badge" as const,
            label: "Error",
            text: "Cursor's saved login is encrypted. Allow Watchtower to use the \"Cursor Safe Storage\" Keychain item, or run `agent login`.",
            color: "#ef4444",
          },
        ],
      }
    : {
        providerId: "cursor",
        displayName: "Cursor",
        plan: "Pro",
        iconUrl: icons.cursor,
        lines: [progress("Plan usage", 22, later, 30 * 24 * 60 * 60 * 1000)],
      },
  {
    providerId: "claude",
    displayName: "Claude",
    plan: "Pro",
    iconUrl: icons.claude,
    lines: [progress("Session", 11, later, 5 * 60 * 60 * 1000)],
  },
]

function emit(event: string, payload: unknown) {
  for (const listener of listeners.get(event) ?? []) listener({ payload })
}

export async function listen(event: string, handler: Listener) {
  const set = listeners.get(event) ?? new Set()
  set.add(handler)
  listeners.set(event, set)
  return () => set.delete(handler)
}

const metas = [
  { id: "cursor", name: "Cursor", brandColor: "#000000", lines: [{ type: "progress", label: "Plan usage", scope: "overview" }], primaryCandidates: ["Plan usage"] },
  { id: "codex", name: "Codex", brandColor: "#74AA9C", lines: [{ type: "progress", label: "Session", scope: "overview" }, { type: "progress", label: "Weekly", scope: "overview" }], primaryCandidates: ["Session"], weeklyCandidate: "Weekly" },
  { id: "claude", name: "Claude", brandColor: "#D97757", lines: [{ type: "progress", label: "Session", scope: "overview" }], primaryCandidates: ["Session"] },
  { id: "kiro", name: "Kiro", brandColor: "#C09CFF", lines: [{ type: "progress", label: "Credits", scope: "overview" }, { type: "progress", label: "Bonus Credits", scope: "overview" }], primaryCandidates: ["Credits"] },
  { id: "kimi", name: "Kimi", brandColor: "#000000", lines: [{ type: "progress", label: "Session", scope: "overview" }, { type: "progress", label: "Monthly", scope: "overview" }], primaryCandidates: ["Session"] },
  { id: "devin", name: "Devin", brandColor: "#000000", lines: [{ type: "progress", label: "ACU", scope: "overview" }], primaryCandidates: ["ACU"] },
  { id: "grok-bot", name: "Grok Bot", brandColor: "#000000", lines: [{ type: "progress", label: "Weekly Usage", scope: "overview" }], primaryCandidates: ["Weekly Usage"], weeklyCandidate: "Weekly Usage" },
].map((meta) => ({ ...meta, iconUrl: icons[meta.id as keyof typeof icons] ?? icons.codex, links: [] }))

export async function invoke(command: string, args?: Record<string, unknown>) {
  if (command === "list_plugins") return metas
  if (command === "start_probe_batch") {
    const batchId = String(args?.batchId ?? "batch")
    const ids = (args?.pluginIds as string[] | undefined) ?? outputs.map((output) => output.providerId)
    setTimeout(() => {
      for (const output of outputs) {
        if (!ids.includes(output.providerId)) continue
        emit("probe:result", { batchId, output })
      }
      if (!codexResetSent && ids.includes("codex")) {
        codexResetSent = true
        setTimeout(() => {
          emit("probe:result", { batchId, output: codexOutput(true) })
          emit("probe:batch-complete", { batchId })
        }, 4500)
        return
      }
      emit("probe:batch-complete", { batchId })
    }, 400)
    return { batchId, pluginIds: ids }
  }
  if (command === "sync_codex_accounts") {
    return {
      accounts: [
        { label: "Personal", home: "/Users/keshav/.codex", source: "default", hasAuth: true },
        { label: "Work", home: "/Users/keshav/.codex-work", source: "detected", hasAuth: true },
      ],
      profileNote: "Codex config profiles share one login. Add another account with its CODEX_HOME folder.",
    }
  }
  if (command === "list_listening_ports") {
    const response = await fetch("/__demo/ports")
    return response.json()
  }
  if (command === "stop_listening_process") {
    await fetch("/__demo/stop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(args ?? {}),
    })
    return null
  }
  return null
}

export function isTauri() {
  return true
}

export class LazyStore {
  async get(key: string) {
    return store.get(key)
  }
  async set(key: string, value: unknown) {
    store.set(key, value)
  }
  async save() {}
  async delete(key: string) {
    store.delete(key)
  }
}

export const error = async () => {}
export const warn = async () => {}
export const info = async () => {}
export async function openUrl() {}
export async function check() {
  return null
}
export async function relaunch() {}
export async function isEnabled() {
  return false
}
export async function enable() {}
export async function disable() {}
export async function getVersion() {
  return "1.0.0"
}
export class PhysicalSize {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
}
export function getCurrentWindow() {
  return { setSize: async () => {}, scaleFactor: async () => window.devicePixelRatio || 1 }
}
export async function currentMonitor() {
  // A 1440x900 point display, reported in physical pixels like Tauri does.
  const scale = window.devicePixelRatio || 1
  return { size: { width: 1440 * scale, height: 900 * scale }, scaleFactor: scale }
}
export async function resolveResource() {
  throw new Error("demo")
}
export const TrayIcon = { getById: async () => { throw new Error("demo") } }
export class Image {}
export const Menu = { new: async () => ({ popup: async () => {}, close: async () => {} }) }
export const MenuItem = { new: async () => ({ close: async () => {} }) }
export const PredefinedMenuItem = { new: async () => ({ close: async () => {} }) }
export async function isPermissionGranted() {
  return true
}
export async function requestPermission() {
  return "granted"
}
export function sendNotification() {}

if (typeof document !== "undefined") {
  document.documentElement.style.background = "#2b2b2e"
  document.documentElement.style.minHeight = "100%"
  document.body.style.margin = "0 auto"
  document.body.style.width = "400px"
  document.body.style.minHeight = "100vh"
  document.body.style.background = "#2b2b2e"
}
