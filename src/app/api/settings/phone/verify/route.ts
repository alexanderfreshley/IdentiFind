/**
 * POST /api/settings/phone/verify
 *
 * Validates the 6-digit OTP entered by the user against the HMAC stored in
 * VerificationToken, then marks the user's phone number as verified.
 *
 * On success:  deletes the token, sets phoneVerified = true.
 * On failure:  returns an appropriate error; after 5 wrong attempts the token
 *              is deleted and the user must request a new code.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

const MAX_ATTEMPTS    = 5;
const IDENTIFIER_PREFIX = "phone_verify:";

// The attempt count is appended to the identifier as ":N" so we can update it
// without needing an extra schema column, e.g. "phone_verify:clxxxx:2"
// A fresh token always starts with the base identifier (no suffix).

const schema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/, "Verification code must be exactly 6 digits."),
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

  const { code } = parsed.data;
  const baseId   = `${IDENTIFIER_PREFIX}${session.user.id}`;

  // Find the token — could be "phone_verify:userId" or "phone_verify:userId:N"
  const tokenRow = await db.verificationToken.findFirst({
    where: { identifier: { startsWith: baseId } },
  });

  if (!tokenRow) {
    return NextResponse.json(
      { error: "No pending verification found. Please request a new code." },
      { status: 404 }
    );
  }

  // ── Check expiry ──────────────────────────────────────────────────────────
  if (new Date() > tokenRow.expires) {
    await db.verificationToken.deleteMany({ where: { identifier: tokenRow.identifier } });
    return NextResponse.json(
      { error: "Verification code has expired. Please request a new one." },
      { status: 410 }
    );
  }

  // ── Parse current attempt count from identifier suffix ────────────────────
  const parts       = tokenRow.identifier.split(":");
  const attempts    = parts.length >= 3 ? parseInt(parts[parts.length - 1], 10) || 0 : 0;
  const newAttempts = attempts + 1;

  // ── Compare HMAC (constant-time via timingSafeEqual) ──────────────────────
  const inputHmac  = Buffer.from(hmacCode(code), "hex");
  const storedHmac = Buffer.from(tokenRow.token, "hex");

  const isValid =
    inputHmac.length === storedHmac.length &&
    crypto.timingSafeEqual(inputHmac, storedHmac);

  if (!isValid) {
    if (newAttempts >= MAX_ATTEMPTS) {
      await db.verificationToken.deleteMany({ where: { identifier: tokenRow.identifier } });
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new code.", tooManyAttempts: true },
        { status: 429 }
      );
    }

    // Update identifier to reflect new attempt count
    const newIdentifier = `${baseId}:${newAttempts}`;
    await db.verificationToken.update({
      where: { identifier: tokenRow.identifier, token: tokenRow.token },
      data:  { identifier: newIdentifier },
    });

    const remaining = MAX_ATTEMPTS - newAttempts;
    return NextResponse.json(
      { error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.` },
      { status: 400 }
    );
  }

  // ── Code is correct — mark phone as verified ──────────────────────────────
  await db.verificationToken.deleteMany({ where: { identifier: tokenRow.identifier } });

  await db.user.update({
    where: { id: session.user.id },
    data:  { phoneVerified: true },
  });

  await logAuditEvent({
    userId:   session.user.id,
    action:   AUDIT_ACTIONS.PROFILE_UPDATE,
    resource: "user",
    resourceId: session.user.id,
    metadata: { event: "phone_verified" },
  });

  return NextResponse.json({ success: true });
}
