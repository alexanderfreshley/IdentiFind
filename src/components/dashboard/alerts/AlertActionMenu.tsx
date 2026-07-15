"use client";

import { useState } from "react";
import { MoreHorizontal, CheckCircle, Flag, X, ExternalLink } from "lucide-react";

interface AlertActionMenuProps {
  findingId: string;
  isImpersonation?: boolean;
}

export function AlertActionMenu({ findingId, isImpersonation = false }: AlertActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: string) => {
    setIsLoading(true);
    setIsOpen(false);
    try {
      const endpoint = isImpersonation
        ? `/api/alerts/impersonation/${findingId}`
        : `/api/alerts/finding/${findingId}`;

      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      window.location.reload();
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const findingActions = [
    {
      label: "Mark Resolved",
      icon: CheckCircle,
      action: "resolve",
      className: "text-green-400 hover:bg-green-500/10",
    },
    {
      label: "Dismiss",
      icon: X,
      action: "dismiss",
      className: "text-white/40 hover:bg-white/5",
    },
  ];

  const impersonationActions = [
    {
      label: "Confirm as Impersonator",
      icon: Flag,
      action: "confirm",
      className: "text-red-400 hover:bg-red-500/10",
    },
    {
      label: "Mark as Reported",
      icon: ExternalLink,
      action: "report",
      className: "text-blue-400 hover:bg-blue-500/10",
    },
    {
      label: "Dismiss (Not Impersonation)",
      icon: X,
      action: "dismiss",
      className: "text-white/40 hover:bg-white/5",
    },
  ];

  const actions = isImpersonation ? impersonationActions : findingActions;

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setIsOpen((v) => !v)}
        disabled={isLoading}
        className="text-white/30 hover:text-white/60 transition-colors p-1 rounded"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Menu */}
          <div className="absolute right-0 top-6 z-50 w-52 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {actions.map((action) => (
              <button
                key={action.action}
                onClick={() => handleAction(action.action)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${action.className}`}
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
