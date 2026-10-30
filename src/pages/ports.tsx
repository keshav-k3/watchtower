import { useCallback, useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChevronRightIcon } from "@hugeicons-pro/core-solid-rounded"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { groupPortsByProcess, meaningfulCwd, type ListeningPort, type PortProcess } from "@/lib/port-groups"

export type { ListeningPort } from "@/lib/port-groups"

type ListeningPortsResponse = {
  supported: boolean
  note: string | null
  ports: ListeningPort[]
}

type ConfirmState = {
  process: PortProcess
  force: boolean
}

const REFRESH_MS = 3000

function formatPorts(ports: number[]): string {
  return ports.map((port) => `:${port}`).join(", ")
}

function ProcessAction({
  process,
  stillRunning,
  onStop,
}: {
  process: PortProcess
  stillRunning: boolean
  onStop: (force: boolean) => void
}) {
  if (process.system) {
    return <span className="label-mono shrink-0 pt-0.5 text-[9px] text-muted-foreground">System</span>
  }
  if (process.selfProcess) {
    return <span className="label-mono shrink-0 pt-0.5 text-[9px] text-muted-foreground">This App</span>
  }
  return (
    <button
      type="button"
      className={cn(
        "label-mono shrink-0 rounded-[6px] border px-2 py-1 text-[9px] leading-3 transition-colors",
        stillRunning
          ? "border-destructive/60 text-destructive hover:bg-destructive/10"
          : "border-line text-foreground hover:border-line-bright hover:bg-surface-raised"
      )}
      aria-label={`${stillRunning ? "Force Stop" : "Stop"} ${process.displayName}`}
      onClick={() => onStop(stillRunning)}
    >
      {stillRunning ? "Force Stop" : "Stop"}
    </button>
  )
}

function ProcessRow({
  process,
  stillRunning,
  expanded,
  onToggle,
  onStop,
}: {
  process: PortProcess
  stillRunning: boolean
  expanded: boolean
  onToggle: () => void
  onStop: (force: boolean) => void
}) {
  const cwd = meaningfulCwd(process.cwd)
  return (
    <li className="px-3 py-2.5" data-pid={process.pid}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="group/row flex min-w-0 flex-1 items-start gap-1.5 text-left"
          aria-expanded={expanded}
          aria-label={`${process.displayName} details`}
          title={process.processName}
          onClick={onToggle}
        >
          <HugeiconsIcon
            icon={ChevronRightIcon}
            className={cn(
              "mt-[3px] size-3 shrink-0 text-muted-foreground transition-transform duration-150 group-hover/row:text-foreground",
              expanded && "rotate-90"
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="min-w-0 break-words text-[13px] font-semibold leading-[18px] text-foreground">
                {process.displayName}
              </span>
              {process.binaryName && (
                <span className="min-w-0 break-all text-[11px] leading-4 text-muted-foreground">
                  {process.binaryName}
                </span>
              )}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {process.ports.map((port) => (
                <span
                  key={port}
                  className="label-mono rounded-[4px] border border-line bg-card px-1.5 py-px text-[10px] leading-[14px] tabular-nums text-foreground"
                >
                  :{port}
                </span>
              ))}
              <span className="label-mono pl-1 text-[9px] tabular-nums text-muted-foreground">PID {process.pid}</span>
            </span>
            {process.project && (
              <span className="mt-1 block break-words text-[11px] leading-4 text-muted-foreground">
                {process.project}
              </span>
            )}
          </span>
        </button>
        <ProcessAction process={process} stillRunning={stillRunning} onStop={onStop} />
      </div>
      {expanded && (
        <dl className="ml-[18px] mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-[8px] border border-line bg-card px-2.5 py-2 text-[11px] leading-4">
          <dt className="label-mono pt-px text-[9px] text-muted-foreground">Path</dt>
          <dd className="min-w-0 break-all text-foreground">{process.processName}</dd>
          <dt className="label-mono pt-px text-[9px] text-muted-foreground">Folder</dt>
          <dd className="min-w-0 break-all text-foreground">{cwd ?? "Not available"}</dd>
          <dt className="label-mono pt-px text-[9px] text-muted-foreground">User</dt>
          <dd className="min-w-0 break-all text-foreground">{process.user}</dd>
        </dl>
      )}
    </li>
  )
}

export function PortsPage() {
  const [ports, setPorts] = useState<ListeningPort[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSystem, setShowSystem] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [stopping, setStopping] = useState(false)
  const [termSent, setTermSent] = useState<Record<number, true>>({})
  const [expandedPid, setExpandedPid] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await invoke<ListeningPortsResponse>("list_listening_ports")
      setPorts(result.ports)
      // Forget SIGTERM marks for pids that are gone, so a reused pid starts at Stop again.
      setTermSent((current) => {
        const live = new Set(result.ports.map((port) => port.pid))
        const next = Object.fromEntries(
          Object.entries(current).filter(([pid]) => live.has(Number(pid)))
        ) as Record<number, true>
        return Object.keys(next).length === Object.keys(current).length ? current : next
      })
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

  const processes = groupPortsByProcess(ports.filter((port) => showSystem || !port.system))

  const stop = async () => {
    // The dialog is the only caller, so confirm is set. The guard is for the click race.
    /* v8 ignore next */
    if (!confirm) return
    const pending = confirm
    setStopping(true)
    try {
      await invoke("stop_listening_process", {
        pid: pending.process.pid,
        force: pending.force,
        expectedProcess: pending.process.processName,
      })
      if (!pending.force) {
        setTermSent((current) => ({ ...current, [pending.process.pid]: true }))
      } else {
        setTermSent((current) => {
          const next = { ...current }
          delete next[pending.process.pid]
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
    <div className="px-4 pb-5">
      <div className="flex items-center justify-between gap-3 pb-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Ports</h2>
        <label className="label-mono flex shrink-0 items-center gap-2 text-[9px] text-muted-foreground">
          Show System
          <Switch
            aria-label="Show System"
            checked={showSystem}
            onCheckedChange={setShowSystem}
          />
        </label>
      </div>
      <p className="pb-3 text-[11px] leading-4 text-muted-foreground">
        Apps listening for TCP connections on this computer. Stop asks first, then lets the app exit on its own.
      </p>
      {note && <p className="pb-2 text-[12px] leading-4 text-muted-foreground">{note}</p>}
      {error && <p className="py-4 text-center text-[12px] leading-4 text-destructive">{error}</p>}
      {confirm && (
        <div
          className="mb-3 rounded-[10px] border border-line border-l-2 border-l-destructive bg-surface px-3 py-2.5"
          role="dialog"
          aria-label="Stop Process"
        >
          <h3 className="break-words text-[13px] font-semibold leading-[18px] text-foreground">
            {confirm.force ? "Force Stop" : "Stop"} {confirm.process.displayName}?
          </h3>
          <p className="label-mono mt-1 break-words text-[9px] leading-3 text-muted-foreground">
            PID {confirm.process.pid} · {formatPorts(confirm.process.ports)}
          </p>
          <p className="mt-1.5 text-[12px] leading-4 text-muted-foreground">
            {confirm.force
              ? "It did not exit after being asked. Force Stop sends SIGKILL and ends it immediately, without cleanup."
              : "This sends SIGTERM, which asks the process to shut down and gives it a moment to clean up."}
          </p>
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="label-mono rounded-[6px] border border-line px-2 py-1 text-[9px] leading-3 text-muted-foreground transition-colors hover:border-line-bright hover:text-foreground"
              onClick={() => setConfirm(null)}
              disabled={stopping}
            >
              Cancel
            </button>
            <button
              type="button"
              className="label-mono rounded-[6px] border border-destructive/60 px-2 py-1 text-[9px] leading-3 text-destructive transition-colors hover:bg-destructive/10"
              onClick={() => void stop()}
              disabled={stopping}
            >
              {stopping ? "Stopping…" : confirm.force ? "Force Stop" : "Stop"}
            </button>
          </div>
        </div>
      )}
      {processes.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
          <p className="label-mono text-[11px] text-muted-foreground">No Listening Ports</p>
          <p className="text-[12px] text-muted-foreground/70">Nothing is accepting connections right now.</p>
        </div>
      )}
      {processes.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
          {processes.map((process) => (
            <ProcessRow
              key={process.pid}
              process={process}
              stillRunning={termSent[process.pid] === true}
              expanded={expandedPid === process.pid}
              onToggle={() => setExpandedPid((current) => (current === process.pid ? null : process.pid))}
              onStop={(force) => setConfirm({ process, force })}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
