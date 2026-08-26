"use client";

import { useState } from "react";
import { Smartphone, ShieldCheck, ShieldX, Loader2, AlertCircle } from "lucide-react";

interface MfaSectionProps {
  mfaEnabled: boolean;
}

export function MfaSection({ mfaEnabled: initial }: MfaSectionProps) {
  const [enabled, setEnabled] = useState(initial);
  const [status, setStatus]   = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const toggle = async (newValue: boolean) => {
    setStatus("loading");
    setMessage("");
    setShowConfirm(false);
    try {
      const res = await fetch("/api/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaEnabled: newValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnabled(data.mfaEnabled);
        setStatus("idle");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Failed to update MFA setting.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className={`flex items-start gap-4 p-4 rounded-xl border ${
        enabled
          ? "bg-green-500/8 border-green-500/20"
          : "bg-white/5 border-white/10"
      }`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          enabled ? "bg-green-500/15" : "bg-white/5"
        }`}>
          {enabled
            ? <ShieldCheck className="h-5 w-5 text-green-400" />
            : <ShieldX className="h-5 w-5 text-white/30" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              Authenticator App (TOTP)
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              enabled
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-white/5 text-white/40 border-white/10"
            }`}>
              {enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <p className="text-xs text-white/40 mt-1 leading-relaxed">
            {enabled
              ? "Two-factor authentication is protecting your account. Use your authenticator app when signing in."
              : "Add a second layer of security. Requires a code from your authenticator app at every login."}
          </p>
        </div>
      </div>

      {/* Recommendations */}
      {!enabled && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-300 space-y-1">
              <p className="font-medium">Your account is less secure without MFA.</p>
              <p className="text-amber-300/70">
                Use a free authenticator app such as{" "}
                <a href="https://authy.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-200">Authy</a>,{" "}
                <a href="https://support.google.com/accounts/answer/1066447" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-200">Google Authenticator</a>, or{" "}
                <a href="https://www.microsoft.com/en-us/security/mobile-authenticator-app" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-200">Microsoft Authenticator</a>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Inline disable confirmation */}
      {showConfirm && enabled && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-red-300">Disable two-factor authentication?</p>
          <p className="text-xs text-white/40">
            Your account will only be protected by your password. This is not recommended.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => toggle(false)}
              className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg"
            >
              Yes, disable MFA
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-sm text-white/40 hover:text-white/70 transition-colors px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action button */}
      {!showConfirm && (
        <button
          onClick={() => enabled ? setShowConfirm(true) : toggle(true)}
          disabled={status === "loading"}
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            enabled
              ? "bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {status !== "loading" && <Smartphone className="h-3.5 w-3.5" />}
          {status === "loading"
            ? "Updating…"
            : enabled
            ? "Disable MFA"
            : "Enable MFA"}
        </button>
      )}

      {status === "error" && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" /> {message}
        </p>
      )}
    </div>
  );
}
