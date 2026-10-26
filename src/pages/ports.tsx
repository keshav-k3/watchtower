import { useCallback, useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"

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

type ListeningPortsResponse = {
  supported: boolean
  note: string | null
  ports: ListeningPort[]
}

type ConfirmState = {
  port: ListeningPort
  force: boolean
}

const REFRESH_MS = 3000

export function PortsPage() {
  const [ports, setPorts] = useState<ListeningPort[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSystem, setShowSystem] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [stopping, setStopping] = useState(false)
  const [termSent, setTermSent] = useState<Record<number, true>>({})

  const refresh = useCallback(async () => {
    try {
      const result = await invoke<ListeningPortsResponse>("list_listening_ports")
      setPorts(result.ports)
      setNote(result.supported ? null : result.note)
      setError(null)
    } catch (refreshError) {
      console.error("Failed to list listening ports:", refreshError)
      setError("Listening ports could not be loaded.")
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  const visible = ports.filter((port) => showSystem || !port.system)

  const stop = async () => {
    // The dialog is the only caller, so confirm is set. The guard is for the click race.
    /* v8 ignore next */
    if (!confirm) return
    const pending = confirm
    setStopping(true)
    try {
      await invoke("stop_listening_process", { pid: pending.port.pid, force: pending.force })
      if (!pending.force) {
        setTermSent((current) => ({ ...current, [pending.port.pid]: true }))
      } else {
        setTermSent((current) => {
          const next = { ...current }
          delete next[pending.port.pid]
          return next
        })
      }
      setConfirm(null)
      await refresh()
    } catch (stopError) {
      console.error("Failed to stop process:", stopError)
      setError(stopError instanceof Error ? stopError.message : String(stopError))
    } finally {
      setStopping(false)
    }
  }

  return (
    <div className="space-y-3 pb-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Ports</h2>
        <button
          type="button"
          aria-pressed={showSystem}
          className="text-xs text-muted-foreground"
          onClick={() => setShowSystem((current) => !current)}
        >
          {showSystem ? "Hide System Processes" : "Show System Processes"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        TCP ports listening on this Mac. Stopping a process asks first, then gives it a chance to exit.
      </p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {visible.length === 0 && !error && (
        <p className="py-8 text-center text-sm text-muted-foreground">No Listening Ports</p>
      )}
      <ul className="space-y-2">
        {visible.map((port) => {
          const stillRunning = termSent[port.pid] === true
          return (
            <li key={`${port.pid}:${port.port}`} className="rounded-[12px] border border-line px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{port.port}</span>
                <span className="truncate text-sm">{port.processName}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                PID {port.pid}
                {port.project ? ` · ${port.project}` : ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {port.cwd ?? "Working directory unavailable"}
              </p>
              {port.selfProcess ? (
                <p className="mt-1 text-xs text-muted-foreground">This is Watchtower.</p>
              ) : stillRunning ? (
                <Button
                  type="button"
                  size="xs"
                  variant="destructive"
                  className="mt-2"
                  onClick={() => setConfirm({ port, force: true })}
                >
                  Force Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setConfirm({ port, force: false })}
                >
                  Stop
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {confirm && (
        <div className="rounded-[12px] border border-line bg-surface p-3" role="dialog" aria-label="Stop Process">
          <h3 className="text-sm font-semibold">{confirm.force ? "Force Stop" : "Stop Process"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {confirm.force
              ? `${confirm.port.processName} on port ${confirm.port.port} did not exit. Force stop ends it immediately.`
              : `Stop ${confirm.port.processName} on port ${confirm.port.port}? It will get a chance to shut down.`}
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="xs" variant="outline" onClick={() => setConfirm(null)} disabled={stopping}>
              Cancel
            </Button>
            <Button type="button" size="xs" variant="destructive" onClick={() => void stop()} disabled={stopping}>
              {confirm.force ? "Force Stop" : "Stop"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
