import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ChangelogDialog } from "./changelog-dialog";
import { Button } from "@/components/ui/button";

interface AboutDialogProps {
  version: string;
  onClose: () => void;
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const handleClick = () => {
    openUrl(href).catch(console.error);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
    >
      {children}
    </button>
  );
}

export function AboutDialog({ version, onClose }: AboutDialogProps) {
  const [view, setView] = useState<"about" | "changelog">("about");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (view !== "about") return;
    previouslyFocused.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus();
    };
  }, [view]);

  // Close on ESC key
  useEffect(() => {
    if (view !== "about") {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, view]);

  // Close when panel hides (loses visibility)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onClose();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (view === "changelog") {
    return (
      <ChangelogDialog
        currentVersion={version}
        onBack={() => setView("about")}
        // In changelog view, Escape should go back to About instead of
        // closing the entire dialog, so hand off to setView.
        onClose={() => setView("about")}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "var(--overlay-scrim)" }}
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="About Watchtower"
        tabIndex={-1}
        className="mx-4 w-full max-w-xs rounded-xl border border-line bg-popover p-5 text-center shadow-[var(--panel-shadow)] outline-none"
      >
        <img
          src="/icon.png"
          alt="Watchtower"
          className="mx-auto mb-3 size-10"
        />

        <h2 className="mb-1 text-[15px] font-semibold">Watchtower</h2>

        <div className="mb-4 flex flex-col items-center gap-2">
          <span className="text-[12px] text-muted-foreground">
            v{version}
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setView("changelog")}
            className="text-[10px] h-5 px-1.5"
          >
            View Changelog
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Built by{" "}
            <ExternalLink href="https://itsbyrob.in/x">Keshav K</ExternalLink>
          </p>
          <p>
            Open source on{" "}
            <ExternalLink href="https://github.com/keshav-k3/watchtower">
              GitHub
            </ExternalLink>
          </p>
          <p className="text-xs pt-1">
            Maintainers:{" "}
            <ExternalLink href="https://github.com/validatedev">
              validatedev
            </ExternalLink>
            ,{" "}
            <ExternalLink href="https://github.com/davidarny">
              davidarny
            </ExternalLink>
          </p>
        </div>
      </div>
    </div>
  );
}

