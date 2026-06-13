import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons-pro/core-solid-rounded"

type PluginErrorProps = {
  message: string
}

function formatMessage(message: string) {
  const parts = message.split(/`([^`]+)`/)
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <code
        key={`code-${index}`}
        className="rounded bg-muted px-1 font-mono text-[0.75rem] leading-tight"
      >
        {part}
      </code>
    ) : (
      part
    )
  )
}

export function PluginError({ message }: PluginErrorProps) {
  return (
    <div role="alert" className="flex items-center gap-2 text-[13px] font-medium leading-5 text-destructive">
      <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
      <div className="cursor-text select-text">{formatMessage(message)}</div>
    </div>
  )
}
