/**
 * POST /api/settings/phone/send
 *
 * Saves the user's phone number (encrypted, unverified) and dispatches a
 * 6-digit SMS verification code via Twilio.
 *
 * The code is stored as an HMAC-SHA256 in the existing VerificationToken table
 * — no schema migration required.
 *
 * Token structure:
 *   identifier : "phone_verify:{userId}"
 *   token      : HMAC-SHA256(code, HASH_PEPPER)  ← hex string
 *   expires    : now + 10 minutes
 *
 * Rate limiting: a new code cannot be requested within 60 seconds of the
 * previous one. The client should show a resend countdown accordingly.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptOptional } from "@/lib/encryption";
import { sendSms, formatOtpMessage } from "@/lib/sms";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

const RESEND_COOLDOWN_SECONDS = 60;
const CODE_TTL_MINUTES        = 10;
const IDENTIFIER_PREFIX       = "phone_verify:";

const schema = z.object({
  phoneNumber: z
    .string()
    .regex(
      /^\+[1-9]\d{6,14}$/,
      "Enter a valid phone number in E.164 format (e.g. +12125551234)."
    ),
});

function hmacCode(code: string): string {
  const pepper = process.env.HASH_PEPPER ?? "";
  return crypto.createHmac("sha256", pepper).update(code).digest("hex");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { phoneNumber } = parsed.data;
  const identifier      = `${IDENTIFIER_PREFIX}${session.user.id}`;

  // ── Rate limit: reject if a code was sent recently ────────────────────────
  const existing = await db.verificationToken.findFirst({
    where: { identifier },
  });
  if (existing) {
    const secondsAgo = (Date.now() - existing.expires.getTime() + CODE_TTL_MINUTES * 60_000) / 1000;
    if (secondsAgo < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsAgo);
      return NextResponse.json(
        { error: `Please wait ${waitSeconds} seconds before requesting a new code.` },
        { status: 429 }
      );
    }
    // Delete stale token before creating a new one
    await db.verificationToken.deleteMany({ where: { identifier } });
  }

  // ── Generate 6-digit code ─────────────────────────────────────────────────
  const code    = String(crypto.randomInt(100_000, 999_999));
  const expires = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  // ── Store encrypted phone number on the user (still unverified) ───────────
  await db.user.update({
    where: { id: session.user.id },
    data: {
      phoneNumber:   encryptOptional(phoneNumber),
      phoneVerified: false,
    },
  });

  // ── Persist HMAC of the code in VerificationToken ────────────────────────
  await db.verificationToken.create({
    data: { identifier, token: hmacCode(code), expires },
  });

  // ── Send SMS ──────────────────────────────────────────────────────────────
  try {
    await sendSms({ to: phoneNumber, body: formatOtpMessage(code) });
  } catch (err) {
    // Clean up the token so the user can retry immediately
    await db.verificationToken.deleteMany({ where: { identifier } });
    console.error("[PHONE/SEND] SMS delivery failed:", err);
    return NextResponse.json(
      { error: "Failed to send SMS. Check your phone number and try again." },
      { status: 502 }
    );
  }

  await logAuditEvent({
    userId:   session.user.id,
    action:   AUDIT_ACTIONS.PROFILE_UPDATE,
    resource: "user",
    resourceId: session.user.id,
    metadata: { event: "phone_verification_sent" },
  });

  return NextResponse.json({
    success:    true,
    expiresAt:  expires.toISOString(),
    // Return masked phone for display (e.g. +1 *** *** 5678)
    maskedPhone: maskPhone(phoneNumber),
  });
}

/** Masks all but the last 4 digits: +12125551234 → +1 *** *** 1234 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  const countryEnd = phone.startsWith("+1") ? 2 : 3;
  const visible    = phone.slice(-4);
  const prefix     = phone.slice(0, countryEnd);
  return `${prefix} *** *** ${visible}`;
}
