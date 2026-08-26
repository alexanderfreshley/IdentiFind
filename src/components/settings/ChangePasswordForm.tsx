"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface ChangePasswordFormProps {
  hasPassword: boolean;  // false = OAuth-only user setting a password for the first time
}

function StrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["bg-red-500", "bg-orange-500", "bg-amber-400", "bg-green-500"];
  const labels = ["Too short", "Weak", "Good", "Strong"];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score - 1] : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${score < 2 ? "text-red-400" : score < 4 ? "text-amber-400" : "text-green-400"}`}>
        {labels[score - 1] ?? "Too short"}
      </p>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      {hint && <p className="text-xs text-white/25 mt-1">{hint}</p>}
    </div>
  );
}

export function ChangePasswordForm({ hasPassword }: ChangePasswordFormProps) {
  const [current, setCurrent]   = useState("");
  const [newPw, setNewPw]       = useState("");
  const [confirm, setConfirm]   = useState("");
  const [status, setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage]   = useState("");

  const canSubmit =
    (!hasPassword || current.length > 0) &&
    newPw.length >= 8 &&
    confirm.length > 0 &&
    status !== "loading";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (newPw !== confirm) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(hasPassword && { currentPassword: current }),
          newPassword: newPw,
          confirmPassword: confirm,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(hasPassword ? "Password updated." : "Password set successfully.");
        setCurrent(""); setNewPw(""); setConfirm("");
        setTimeout(() => setStatus("idle"), 4000);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Update failed.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasPassword && (
        <PasswordInput
          label="Current Password"
          value={current}
          onChange={setCurrent}
          placeholder="Enter current password"
        />
      )}

      <PasswordInput
        label={hasPassword ? "New Password" : "Password"}
        value={newPw}
        onChange={setNewPw}
        placeholder="Min. 8 characters"
        hint="Must include uppercase, a number, and a special character."
      />
      {newPw && <StrengthBar password={newPw} />}

      <PasswordInput
        label="Confirm Password"
        value={confirm}
        onChange={setConfirm}
        placeholder="Repeat new password"
      />
      {confirm && newPw !== confirm && (
        <p className="text-xs text-red-400 -mt-2">Passwords do not match.</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {status === "loading"
            ? "Saving…"
            : hasPassword
            ? "Update Password"
            : "Set Password"}
        </button>

        {status === "success" && (
          <span className="flex items-center gap-1.5 text-sm text-green-400">
            <CheckCircle className="h-3.5 w-3.5" /> {message}
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <AlertCircle className="h-3.5 w-3.5" /> {message}
          </span>
        )}
      </div>
    </form>
  );
}
