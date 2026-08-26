/**
 * PATCH /api/settings/password — Change the authenticated user's password.
 *
 * Requires the current password for verification (prevents session-hijack attacks).
 * OAuth-only accounts (no passwordHash) may also set a password for the first time
 * by omitting currentPassword.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be 128 characters or fewer.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character."),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // If user already has a password, require currentPassword
  if (user.passwordHash) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    // Prevent re-use of current password
    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame) {
      return NextResponse.json(
        { error: "New password must be different from your current password." },
        { status: 400 }
      );
    }
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash, failedLoginAttempts: 0, lockedUntil: null },
  });

  await logAuditEvent({
    userId: session.user.id,
    action: AUDIT_ACTIONS.AUTH_LOGIN,
    resource: "user",
    resourceId: session.user.id,
    metadata: { event: "password_change" },
  });

  return NextResponse.json({ success: true });
}
