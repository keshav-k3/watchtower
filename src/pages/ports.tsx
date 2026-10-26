import { useCallback, useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Switch } from "@/components/ui/switch"

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
    <div className="pb-5">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h2 className="text-[13px] font-semibold text-foreground">Ports</h2>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Show System
          <Switch
            aria-label="Show System"
            checked={showSystem}
            onCheckedChange={setShowSystem}
          />
        </label>
      </div>
      <p className="px-3 pb-2 text-[11px] leading-4 text-muted-foreground">
        TCP ports listening on this Mac. Stopping a process asks first, then gives it a chance to exit.
      </p>
      {note && <p className="px-3 pb-2 text-[12px] text-muted-foreground">{note}</p>}
      {error && <p className="px-3 py-6 text-center text-[12px] text-destructive">{error}</p>}
      {visible.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
          <p className="text-[13px] font-medium text-foreground">No Listening Ports</p>
          <p className="text-[12px] text-muted-foreground">Nothing is accepting connections right now.</p>
        </div>
      )}
      <ul className="divide-y divide-line border-t border-line">
        {visible.map((port) => {
          const stillRunning = termSent[port.pid] === true
          return (
            <li key={`${port.pid}:${port.port}`} className="flex items-center gap-2 px-3 py-2">
              <span className="label-mono w-12 shrink-0 text-[13px] tabular-nums text-foreground">
                {port.port}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="break-words text-[13px] font-medium text-foreground">
                    {port.processName}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    PID {port.pid}
                  </span>
                </div>
                <p
                  className="truncate text-[11px] leading-4 text-muted-foreground"
                  title={port.cwd ?? undefined}
                >
                  {port.project ? `${port.project} · ` : ""}
                  {port.cwd ?? "Working directory unavailable"}
                </p>
              </div>
              {port.system ? (
                <span className="label-mono shrink-0 text-[10px] uppercase text-muted-foreground">
                  System
                </span>
              ) : port.selfProcess ? (
                <span className="label-mono shrink-0 text-[10px] uppercase text-muted-foreground">
                  Watchtower
                </span>
              ) : stillRunning ? (
                <button
                  type="button"
                  className="shrink-0 text-[12px] font-medium text-destructive underline-offset-2 hover:underline"
                  onClick={() => setConfirm({ port, force: true })}
                >
                  Force Stop
                </button>
              ) : (
                <button
                  type="button"
                  className="shrink-0 text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => setConfirm({ port, force: false })}
                >
                  Stop
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {confirm && (
        <div className="border-t border-line bg-surface px-3 py-3" role="dialog" aria-label="Stop Process">
          <h3 className="text-[13px] font-semibold text-foreground">
            {confirm.force ? "Force Stop" : "Stop"} {confirm.port.processName} on :{confirm.port.port}?
          </h3>
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
            {confirm.force
              ? "It did not exit after being asked. Force Stop sends SIGKILL and ends it immediately, without cleanup."
              : "This sends SIGTERM, which asks the process to shut down and gives it a moment to clean up."}
          </p>
          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              className="text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setConfirm(null)}
              disabled={stopping}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-[12px] font-medium text-destructive underline-offset-2 hover:underline"
              onClick={() => void stop()}
              disabled={stopping}
            >
              {stopping ? "Stopping…" : confirm.force ? "Force Stop" : "Stop"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
