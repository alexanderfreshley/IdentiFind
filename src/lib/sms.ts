/**
 * SMS utility for IdentiFind — thin wrapper around Twilio's REST API.
 *
 * Uses native fetch so no additional npm dependency is required.
 * Falls back to console.log in development when Twilio keys are not configured,
 * so the verification flow can be tested locally without a Twilio account.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — from https://console.twilio.com (e.g. ACxxxxxxxx)
 *   TWILIO_AUTH_TOKEN    — from https://console.twilio.com
 *   TWILIO_PHONE_NUMBER  — Twilio-purchased number in E.164 format (e.g. +15551234567)
 */

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

interface SendSmsOptions {
  to: string;       // E.164 format, e.g. +12125551234
  body: string;
}

interface TwilioErrorResponse {
  code: number;
  message: string;
  more_info: string;
  status: number;
}

/**
 * Sends an SMS via Twilio's Messages API.
 * Throws on delivery failure so callers can surface the error to the user.
 */
export async function sendSms({ to, body }: SendSmsOptions): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;

  // ── Dev fallback ──────────────────────────────────────────────────────────
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `\n[SMS DEV FALLBACK] Twilio not configured — message that would have been sent:\n` +
        `  To:   ${to}\n` +
        `  Body: ${body}\n`
      );
      return; // Succeed silently in dev so the UI flow can be tested
    }
    throw new Error(
      "SMS service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER."
    );
  }

  // ── Basic credential format check ────────────────────────────────────────
  if (!sid.startsWith("AC")) {
    throw new Error("TWILIO_ACCOUNT_SID must start with 'AC'.");
  }

  // ── POST to Twilio REST API ───────────────────────────────────────────────
  const url  = `${TWILIO_API_BASE}/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err: TwilioErrorResponse = await res.json().catch(() => ({
      message: `HTTP ${res.status}`,
    }));
    throw new Error(`Twilio error ${err.code ?? res.status}: ${err.message}`);
  }
}

/**
 * Formats an OTP SMS message body.
 */
export function formatOtpMessage(code: string, appName = "IdentiFind"): string {
  return `Your ${appName} verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
}
