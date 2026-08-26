"use client";

import { useState } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { signOut } from "next-auth/react";

interface DeleteAccountSectionProps {
  hasPassword: boolean;
  userEmail: string;
}

export function DeleteAccountSection({ hasPassword, userEmail }: DeleteAccountSectionProps) {
  const [open, setOpen]         = useState(false);
  const [confirmation, setConf] = useState("");
  const [status, setStatus]     = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const expectedText = hasPassword ? "your password" : '"DELETE"';
  const placeholder  = hasPassword ? "Enter your password" : 'Type DELETE';

  const handleDelete = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/settings/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const data = await res.json();
      if (res.ok) {
        // Sign out and redirect to home
        await signOut({ callbackUrl: "/" });
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Deletion failed.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Try again.");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 px-4 py-2 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete My Account
      </button>
    );
  }

  return (
    <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-300">
            This action is permanent and cannot be undone.
          </p>
          <p className="text-xs text-white/40 mt-1 leading-relaxed">
            Deleting your account will permanently remove your identity profile, all connected
            accounts, security findings, and audit history for{" "}
            <span className="text-white/60">{userEmail}</span>.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-white/50 mb-1.5">
          Confirm by entering {expectedText}
        </label>
        <input
          type={hasPassword ? "password" : "text"}
          value={confirmation}
          onChange={(e) => setConf(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500 transition-colors"
        />
      </div>

      {errorMsg && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleDelete}
          disabled={!confirmation || status === "loading"}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {status === "loading" ? "Deleting…" : "Permanently Delete Account"}
        </button>
        <button
          onClick={() => { setOpen(false); setConf(""); setStatus("idle"); setErrorMsg(""); }}
          className="text-sm text-white/30 hover:text-white/60 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
