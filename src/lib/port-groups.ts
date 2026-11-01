export type ListeningPort = {
  port: number
  pid: number
  processName: string
  user: string
  cwd: string | null
  project: string | null
  system: boolean
  selfProcess: boolean
}

/** One running process and every TCP port it is listening on. */
export type PortProcess = {
  pid: number
  /** The executable as the system reports it, often a full path on macOS. */
  processName: string
  /** Short name to show: the app bundle name, or the binary name. */
  displayName: string
  /** Binary name when it differs from displayName (e.g. a helper inside an app). */
  binaryName: string | null
  ports: number[]
  user: string
  cwd: string | null
  project: string | null
  system: boolean
  selfProcess: boolean
}

function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, "")
  const slash = trimmed.lastIndexOf("/")
  return slash === -1 ? trimmed : trimmed.slice(slash + 1)
}

/**
 * "/Applications/Raycast.app/Contents/MacOS/Raycast" -> "Raycast".
 * "/opt/podman/bin/gvproxy" -> "gvproxy". Plain names pass through.
 */
export function friendlyProcessName(processName: string): { displayName: string; binaryName: string | null } {
  const name = processName.trim()
  const binary = basename(name) || name
  const app = /(?:^|\/)([^/]+)\.app(?:\/|$)/.exec(name)
  if (app) {
    return { displayName: app[1], binaryName: binary.toLowerCase() !== app[1].toLowerCase() ? binary : null }
  }
  return { displayName: binary, binaryName: null }
}

/** A working directory worth showing: not missing and not just "/". */
export function meaningfulCwd(cwd: string | null): string | null {
  if (!cwd) return null
  const trimmed = cwd.trim()
  return trimmed && trimmed !== "/" ? trimmed : null
}

export function groupPortsByProcess(ports: ListeningPort[]): PortProcess[] {
  const byPid = new Map<number, PortProcess>()
  for (const port of ports) {
    const existing = byPid.get(port.pid)
    if (existing) {
      if (!existing.ports.includes(port.port)) existing.ports.push(port.port)
      continue
    }
    byPid.set(port.pid, {
      pid: port.pid,
      processName: port.processName,
      ...friendlyProcessName(port.processName),
      ports: [port.port],
      user: port.user,
      cwd: port.cwd,
      project: port.project,
      system: port.system,
      selfProcess: port.selfProcess,
    })
  }
  const groups = Array.from(byPid.values())
  for (const group of groups) group.ports.sort((a, b) => a - b)
  return groups.sort((a, b) => a.ports[0] - b.ports[0] || a.pid - b.pid)
}
