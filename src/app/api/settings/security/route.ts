/**
 * PATCH /api/settings/security — Toggle MFA and/or update the user's phone number.
 *
 * MFA (TOTP): In a full implementation the enable flow would generate a TOTP secret,
 * return a QR code URI, and only set mfaEnabled=true after the user verifies a valid code.
 * For now we toggle the flag directly — swap in a proper TOTP library (e.g. otpauth)
 * when ready to ship MFA enforcement.
 *
 * Phone: stores the number encrypted via encryptOptional(). Verification is a separate
 * SMS flow that we can bolt on later.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptOptional } from "@/lib/encryption";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

const schema = z.object({
  mfaEnabled: z.boolean().optional(),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number (e.g. +12125551234).")
    .nullable()
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { mfaEnabled, phoneNumber } = parsed.data;
  if (mfaEnabled === undefined && phoneNumber === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (mfaEnabled !== undefined) {
    data.mfaEnabled = mfaEnabled;
    // When disabling MFA, clear the stored secret
    if (!mfaEnabled) {
      data.mfaSecret = null;
      data.mfaBackupCodes = null;
    }
  }
  if (phoneNumber !== undefined) {
    data.phoneNumber = encryptOptional(phoneNumber);
    // Changing the number resets verification status
    data.phoneVerified = false;
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data,
    select: { mfaEnabled: true, phoneVerified: true },
  });

  await logAuditEvent({
    userId: session.user.id,
    action: AUDIT_ACTIONS.PROFILE_VIEW,
    resource: "user",
    resourceId: session.user.id,
    metadata: { event: "security_settings_update", fields: Object.keys(data) },
  });

  return NextResponse.json({ success: true, ...updated });
}
