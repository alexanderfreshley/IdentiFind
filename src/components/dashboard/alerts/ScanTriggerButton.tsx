"use client";

import { useState } from "react";
import { RefreshCw, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanTriggerButtonProps {
  className?: string;
}

export function ScanTriggerButton({ className }: ScanTriggerButtonProps) {
  const [state, setState] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [progress, setProgress] = useState<string>("");

  const handleScan = async () => {
    if (state === "scanning") return;
    setState("scanning");
    setProgress("Initializing scan...");

    try {
      // Simulate phase messages while waiting
      const phases = [
        "Querying breach databases...",
        "Checking HIBP, DeHashed, IntelX...",
        "Scanning for impersonators...",
        "Checking certificate transparency...",
        "Scoring findings...",
      ];
      let phase = 0;
      const interval = setInterval(() => {
        if (phase < phases.length - 1) {
          phase++;
          setProgress(phases[phase]);
        }
      }, 4000);

      const res = await fetch("/api/scan", { method: "POST" });
      clearInterval(interval);

      if (res.ok) {
        setState("done");
        setProgress("Scan complete!");
        // Reload page to show fresh results
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setState("error");
        setProgress("Scan failed.");
        setTimeout(() => setState("idle"), 4000);
      }
    } catch {
      setState("error");
      setProgress("Network error.");
      setTimeout(() => setState("idle"), 4000);
    }
  };

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <button
        onClick={handleScan}
        disabled={state === "scanning"}
        className={cn(
          "flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors",
          state === "done"
            ? "bg-green-600 text-white"
            : state === "error"
            ? "bg-red-600 text-white"
            : "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
        )}
      >
        {state === "scanning" && <Loader2 className="h-4 w-4 animate-spin" />}
        {state === "done" && <CheckCircle className="h-4 w-4" />}
        {state === "idle" || state === "error" ? (
          <RefreshCw className="h-4 w-4" />
        ) : null}
        {state === "scanning"
          ? "Scanning..."
          : state === "done"
          ? "Complete!"
          : state === "error"
          ? "Failed"
          : "Run Full Scan"}
      </button>
      {(state === "scanning" || state === "done") && (
        <span className="text-xs text-white/40">{progress}</span>
      )}
    </div>
  );
}
