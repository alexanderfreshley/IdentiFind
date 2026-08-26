"use client";

/**
 * PhoneSection — 3-step phone verification widget.
 *
 * Step 1 — ENTER:   User types their phone number and clicks "Send Code".
 * Step 2 — VERIFY:  User enters the 6-digit SMS code with a 60-second resend
 *                   cooldown. Up to 5 attempts before the code is invalidated.
 * Step 3 — DONE:    Success state; component shows "Verified" badge and resets.
 */

import { useState, useEffect, useRef } from "react";
import {
  Loader2, CheckCircle, AlertCircle, Smartphone, ArrowLeft, RefreshCw,
} from "lucide-react";

interface PhoneSectionProps {
  phoneVerified: boolean;
}

type Step = "idle" | "entering" | "verifying" | "done";

// ── Helpers ───────────────────────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return [
    "w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-white/20",
    "focus:outline-none transition-colors",
    hasError ? "border-red-500 focus:border-red-400" : "border-white/10 focus:border-blue-500",
  ].join(" ");
}

// ── Resend countdown ─────────────────────────────────────────────────────────

function ResendCountdown({
  expiresAt,
  onResend,
  resending,
}: {
  expiresAt: Date;
  onResend: () => void;
  resending: boolean;
}) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000) - (10 * 60 - 60))
  );

  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secs]);

  if (secs > 0) {
    return (
      <span className="text-xs text-white/30">
        Resend in {secs}s
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onResend}
      disabled={resending}
      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
    >
      {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      Resend code
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PhoneSection({ phoneVerified: initialVerified }: PhoneSectionProps) {
  const [step, setStep]             = useState<Step>("idle");
  const [verified, setVerified]     = useState(initialVerified);

  // Step 1 state
  const [phone, setPhone]           = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError]   = useState("");

  // Step 2 state
  const [code, setCode]             = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [expiresAt, setExpiresAt]   = useState<Date | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [resending, setResending]   = useState(false);
  const codeInputRef                = useRef<HTMLInputElement>(null);

  // Auto-focus code input when step changes to verifying
  useEffect(() => {
    if (step === "verifying") codeInputRef.current?.focus();
  }, [step]);

  // ── Send code ───────────────────────────────────────────────────────────
  const handleSend = async (phoneOverride?: string) => {
    const target = (phoneOverride ?? phone).trim();
    if (!target) return;

    setSendLoading(true);
    setSendError("");
    setVerifyError("");

    try {
      const res  = await fetch("/api/settings/phone/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phoneNumber: target }),
      });
      const data = await res.json();

      if (res.ok) {
        setMaskedPhone(data.maskedPhone ?? target);
        setExpiresAt(new Date(data.expiresAt));
        setCode("");
        setStep("verifying");
      } else {
        setSendError(data.error ?? "Failed to send code.");
      }
    } catch {
      setSendError("Network error. Check your connection and try again.");
    } finally {
      setSendLoading(false);
    }
  };

  // ── Resend ──────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setResending(true);
    setVerifyError("");
    setCode("");
    await handleSend(phone);
    setResending(false);
  };

  // ── Verify code ─────────────────────────────────────────────────────────
  const handleVerify = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setVerifyError("Enter the 6-digit code from your SMS.");
      return;
    }

    setVerifyLoading(true);
    setVerifyError("");

    try {
      const res  = await fetch("/api/settings/phone/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();

      if (res.ok) {
        setVerified(true);
        setStep("done");
        // Auto-reset to idle after a few seconds
        setTimeout(() => setStep("idle"), 4000);
      } else {
        setVerifyError(data.error ?? "Verification failed.");
        if (data.tooManyAttempts) {
          // Force back to step 1 so they can request a fresh code
          setTimeout(() => {
            setStep("entering");
            setCode("");
          }, 2500);
        }
      }
    } catch {
      setVerifyError("Network error. Try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // Allow pressing Enter to advance
  const onPhoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };
  const onCodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleVerify();
  };

  // ── Idle / verified state ────────────────────────────────────────────────
  if (step === "idle") {
    return (
      <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          verified ? "bg-green-500/15" : "bg-white/5"
        }`}>
          <Smartphone className={`h-4.5 w-4.5 ${verified ? "text-green-400" : "text-white/30"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Phone Number</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              verified
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-white/5 text-white/40 border-white/10"
            }`}>
              {verified ? "Verified" : "Not Verified"}
            </span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            {verified
              ? "Your phone number is verified and on file."
              : "Add a phone number for account recovery and security alerts."}
          </p>
        </div>
        <button
          onClick={() => setStep("entering")}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 whitespace-nowrap"
        >
          {verified ? "Update →" : "Add →"}
        </button>
      </div>
    );
  }

  // ── Done state (brief success flash) ────────────────────────────────────
  if (step === "done") {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-500/8 border border-green-500/20 rounded-xl">
        <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-300">Phone number verified!</p>
          <p className="text-xs text-white/40 mt-0.5">
            Your number is now confirmed and linked to your account.
          </p>
        </div>
      </div>
    );
  }

  // ── Step 1: Enter phone number ───────────────────────────────────────────
  if (step === "entering") {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">
            Phone Number
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSendError(""); }}
              onKeyDown={onPhoneKeyDown}
              placeholder="+12125551234"
              autoFocus
              className={inputCls(!!sendError)}
            />
            <button
              onClick={() => handleSend()}
              disabled={!phone.trim() || sendLoading}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              {sendLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                : "Send Code"}
            </button>
            <button
              onClick={() => { setStep("idle"); setSendError(""); setPhone(""); }}
              className="text-sm text-white/30 hover:text-white/60 px-3 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-white/25 mt-1.5">
            Include your country code — e.g. <span className="text-white/40">+1</span> for US/Canada,{" "}
            <span className="text-white/40">+44</span> for UK.
          </p>
        </div>

        {sendError && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {sendError}
          </p>
        )}
      </div>
    );
  }

  // ── Step 2: Enter verification code ─────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Sent notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/8 border border-blue-500/20 rounded-xl">
        <Smartphone className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-white">
            Code sent to <span className="text-blue-300">{maskedPhone}</span>
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            Enter the 6-digit code from your SMS. Valid for 10 minutes.
          </p>
        </div>
      </div>

      {/* Code input */}
      <div>
        <label className="block text-xs font-medium text-white/50 mb-1.5">
          Verification Code
        </label>
        <div className="flex gap-2">
          <input
            ref={codeInputRef}
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              setVerifyError("");
            }}
            onKeyDown={onCodeKeyDown}
            placeholder="123456"
            autoComplete="one-time-code"
            className={`${inputCls(!!verifyError)} text-center tracking-[0.35em] text-lg font-mono max-w-[140px]`}
          />
          <button
            onClick={handleVerify}
            disabled={code.length !== 6 || verifyLoading}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {verifyLoading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…</>
              : "Verify"}
          </button>
        </div>

        {verifyError && (
          <p className="text-xs text-red-400 flex items-center gap-1.5 mt-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {verifyError}
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between text-xs pt-1">
        <button
          onClick={() => { setStep("entering"); setCode(""); setVerifyError(""); }}
          className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Change number
        </button>

        {expiresAt && (
          <ResendCountdown
            expiresAt={expiresAt}
            onResend={handleResend}
            resending={resending}
          />
        )}
      </div>
    </div>
  );
}
