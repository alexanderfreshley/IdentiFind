"use client";

import { useState } from "react";
import { RefreshCw, Trash2, Loader2, CheckCircle } from "lucide-react";

interface AccountRowActionsProps {
  accountId: string;
  username: string;
  platform: string;
}

export function AccountRowActions({
  accountId,
  username,
  platform,
}: AccountRowActionsProps) {
  const [syncState, setSyncState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [deleteState, setDeleteState] = useState<"idle" | "confirming" | "loading">("idle");

  // ─── Sync ─────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    if (syncState === "loading") return;
    setSyncState("loading");
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: "POST" });
      if (res.ok) {
        setSyncState("done");
        setTimeout(() => setSyncState("idle"), 2500);
      } else {
        setSyncState("error");
        setTimeout(() => setSyncState("idle"), 2500);
      }
    } catch {
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 2500);
    }
  };

  // ─── Disconnect ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (deleteState === "idle") {
      setDeleteState("confirming");
      return;
    }
    if (deleteState === "confirming") {
      setDeleteState("loading");
      try {
        const res = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
        if (res.ok) {
          window.location.reload();
        } else {
          setDeleteState("idle");
        }
      } catch {
        setDeleteState("idle");
      }
    }
  };

  const cancelDelete = () => setDeleteState("idle");

  // ─── Confirming state: show small inline confirm ───────────────────────────
  if (deleteState === "confirming") {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-white/40 mr-1">Remove @{username}?</span>
        <button
          onClick={handleDelete}
          className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20"
        >
          Yes
        </button>
        <button
          onClick={cancelDelete}
          className="text-xs text-white/30 hover:text-white/60 transition-colors px-1.5 py-0.5"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={syncState === "loading"}
        title={
          syncState === "done"
            ? "Synced!"
            : syncState === "error"
            ? "Sync failed"
            : `Sync ${platform}`
        }
        className="text-white/30 hover:text-blue-400 transition-colors p-1 rounded disabled:opacity-50"
      >
        {syncState === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : syncState === "done" ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Disconnect button */}
      <button
        onClick={handleDelete}
        disabled={deleteState === "loading"}
        title="Disconnect account"
        className="text-white/30 hover:text-red-400 transition-colors p-1 rounded disabled:opacity-50"
      >
        {deleteState === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
