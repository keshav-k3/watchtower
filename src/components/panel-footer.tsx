import { useLayoutEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AboutDialog } from "@/components/about-dialog";
import type { UpdateStatus } from "@/hooks/use-app-update";
import { formatCountdown, nextCountdownDelayMs, nextRefreshRemainingMs } from "@/lib/probe-schedule";

interface PanelFooterProps {
  version: string;
  autoUpdateNextAt: number | null;
  updateStatus: UpdateStatus;
  onUpdateInstall: () => void;
  onUpdateCheck: () => void;
  onRefreshAll?: () => void;
  showAbout: boolean;
  onShowAbout: () => void;
  onCloseAbout: () => void;
  panelVisible?: boolean;
}

function VersionDisplay({
  version,
  updateStatus,
  onUpdateInstall,
  onUpdateCheck,
  onVersionClick,
}: {
  version: string;
  updateStatus: UpdateStatus;
  onUpdateInstall: () => void;
  onUpdateCheck: () => void;
  onVersionClick: () => void;
}) {
  switch (updateStatus.status) {
    case "downloading":
      return (
        <span className="label-mono text-[10px] text-muted-foreground">
          {updateStatus.progress >= 0
            ? `Downloading update ${updateStatus.progress}%`
            : "Downloading update..."}
        </span>
      );
    case "ready":
      return (
        <Button
          variant="destructive"
          size="xs"
          className="update-border-beam"
          onClick={onUpdateInstall}
        >
          Restart to update
        </Button>
      );
    case "installing":
      return (
        <span className="label-mono text-[10px] text-muted-foreground">Installing...</span>
      );
    case "error":
      if (updateStatus.message === "Update check failed") {
        return (
          <button
            type="button"
            onClick={onUpdateCheck}
            className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={updateStatus.message}
          >
            Updates soon
          </button>
        );
      }
      return (
        <span className="label-mono text-[10px] text-destructive" title={updateStatus.message}>
          Update failed
        </span>
      );
    default:
      return (
        <button
          type="button"
          onClick={onVersionClick}
          className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Watchtower {version}
        </button>
      );
  }
}

export function PanelFooter({
  version,
  autoUpdateNextAt,
  updateStatus,
  onUpdateInstall,
  onUpdateCheck,
  onRefreshAll,
  showAbout,
  onShowAbout,
  onCloseAbout,
  panelVisible = true,
}: PanelFooterProps) {
  const [now, setNow] = useState(() => Date.now());

  // The ticker stops while the panel is hidden. Read the clock again as soon
  // as it shows (before paint), or the label measures from the moment it hid
  // and reads e.g. "1667m" after a day in the menu bar.
  useLayoutEffect(() => {
    if (!autoUpdateNextAt || !panelVisible) return;
    let timer = 0;
    const tick = () => {
      const nextNow = Date.now();
      setNow(nextNow);
      timer = window.setTimeout(tick, nextCountdownDelayMs(autoUpdateNextAt - nextNow));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [autoUpdateNextAt, panelVisible]);

  const countdownLabel = useMemo(() => {
    if (!autoUpdateNextAt) return "Paused";
    return `Next update in ${formatCountdown(nextRefreshRemainingMs(autoUpdateNextAt, now))}`;
  }, [autoUpdateNextAt, now]);

  return (
    <>
      <div className="mx-4 flex h-9 shrink-0 items-center justify-between gap-3 border-t border-line">
        <VersionDisplay
          version={version}
          updateStatus={updateStatus}
          onUpdateInstall={onUpdateInstall}
          onUpdateCheck={onUpdateCheck}
          onVersionClick={onShowAbout}
        />
        {autoUpdateNextAt !== null && onRefreshAll ? (
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.blur()
              onRefreshAll()
            }}
            className="label-mono text-[10px] text-muted-foreground tabular-nums hover:text-foreground transition-colors cursor-pointer"
            aria-label={`Refresh now, ${countdownLabel}`}
            title="Refresh Now"
          >
            {countdownLabel}
          </button>
        ) : (
          <span className="label-mono text-[10px] text-muted-foreground tabular-nums">
            {countdownLabel}
          </span>
        )}
      </div>
      {showAbout && (
        <AboutDialog version={version} onClose={onCloseAbout} />
      )}
    </>
  );
}
