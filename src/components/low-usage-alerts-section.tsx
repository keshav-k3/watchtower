import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  LOW_USAGE_THRESHOLD_OPTIONS,
  saveLowUsageAlerts,
  type LowUsageAlertSettings,
} from "@/lib/settings"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

export function LowUsageAlertsSection() {
  const settings = useAppPreferencesStore((state) => state.lowUsageAlerts)
  const setSettings = useAppPreferencesStore((state) => state.setLowUsageAlerts)

  const update = (next: LowUsageAlertSettings) => {
    setSettings(next)
    void saveLowUsageAlerts(next).catch((error) => {
      console.error("Failed to save low usage alerts:", error)
    })
  }

  return (
    <div>
      <h2 className="px-1 pb-1 text-[13px] font-semibold text-foreground">Low Usage Alerts</h2>
      <p className="px-1 pb-2 text-[11px] leading-4 text-muted-foreground">
        One notification when a provider drops below this much left. Quiet again until it resets.
      </p>
      <div className="divide-y divide-line border-t border-line">
        <div className="flex items-center justify-between gap-2 py-2 pl-1">
          <span className="text-[13px] text-foreground">Notify When Low</span>
          <Switch
            aria-label="Notify When Low"
            checked={settings.enabled}
            onCheckedChange={(enabled) => update({ ...settings, enabled })}
          />
        </div>
        <div className="flex items-center justify-between gap-2 py-2 pl-1">
          <span className={cn("text-[13px]", settings.enabled ? "text-foreground" : "text-muted-foreground")}>
            Alert Below
          </span>
          <div role="group" aria-label="Alert Below" className="flex gap-1">
            {LOW_USAGE_THRESHOLD_OPTIONS.map((option) => {
              const selected = settings.thresholdPercent === option
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  disabled={!settings.enabled}
                  onClick={() => update({ ...settings, thresholdPercent: option })}
                  className={cn(
                    "rounded-[6px] border px-1.5 py-0.5 text-[11px] tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    selected
                      ? "border-line-bright bg-surface-raised text-foreground"
                      : "border-line text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option}%
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
