"use client";

/**
 * ImpersonationActions
 *
 * Renders the action controls on an impersonation alert card:
 *  • "Report to Platform" button — opens ImpersonationReportPanel modal
 *  • Inline confirm / dismiss as a compact ⋯ menu
 *
 * This replaces AlertActionMenu for impersonation-type alerts.
 */

import { useState } from "react";
import { Flag, MoreHorizontal, CheckCircle, X } from "lucide-react";
import { ImpersonationReportPanel } from "./ImpersonationReportPanel";
import type { SocialPlatform } from "@/types";

interface ImpersonationActionsProps {
  alertId: string;
  platform: SocialPlatform;
  platformName: string;
  platformColor: string;
  suspectedUsername: string;
  suspectedProfileUrl: string | null;
}

export function ImpersonationActions({
  alertId,
  platform,
  platformName,
  platformColor,
  suspectedUsername,
  suspectedProfileUrl,
}: ImpersonationActionsProps) {
  const [panelOpen, setPanelOpen]   = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [isLoading, setIsLoading]   = useState(false);

  const handleAction = async (action: "report" | "confirm" | "dismiss") => {
    setIsLoading(true);
    setPanelOpen(false);
    setMenuOpen(false);
    try {
      await fetch(`/api/alerts/impersonation/${alertId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      });
      window.location.reload();
    } catch (err) {
      console.error("Impersonation action failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* ── Inline controls ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Primary CTA: open the guided report panel */}
        <button
          onClick={() => setPanelOpen(true)}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <Flag className="h-3 w-3" />
          Report
        </button>

        {/* Secondary: quick confirm / dismiss via ⋯ menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            disabled={isLoading}
            className="text-white/30 hover:text-white/60 transition-colors p-1.5 rounded"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-7 z-50 w-52 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <button
                  onClick={() => handleAction("confirm")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Flag className="h-3.5 w-3.5" />
                  Confirm as Impersonator
                </button>
                <button
                  onClick={() => handleAction("report")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-green-400 hover:bg-green-500/10 transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Mark as Reported
                </button>
                <button
                  onClick={() => handleAction("dismiss")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/40 hover:bg-white/5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Dismiss (Not Impersonation)
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Guided report panel modal ────────────────────────────────────── */}
      {panelOpen && (
        <ImpersonationReportPanel
          alertId={alertId}
          platform={platform}
          platformName={platformName}
          platformColor={platformColor}
          suspectedUsername={suspectedUsername}
          suspectedProfileUrl={suspectedProfileUrl}
          onClose={() => setPanelOpen(false)}
          onAction={handleAction}
          isLoading={isLoading}
        />
      )}
    </>
  );
}
