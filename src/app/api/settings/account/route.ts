/**
 * DELETE /api/settings/account — Permanently delete the authenticated user's account.
 *
 * Requires the user's current password as a final confirmation (or the string "DELETE"
 * for OAuth-only accounts with no password set).
 *
 * Cascade deletes are handled by Prisma (onDelete: Cascade on all relations).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  confirmation: z.string().min(1, "Confirmation required."),
});

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { confirmation } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Password users must enter their password; OAuth-only users type "DELETE"
  if (user.passwordHash) {
    const isValid = await bcrypt.compare(confirmation, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Password is incorrect." }, { status: 400 });
    }
  } else {
    if (confirmation.toUpperCase() !== "DELETE") {
      return NextResponse.json(
        { error: 'Type "DELETE" to confirm account deletion.' },
        { status: 400 }
      );
    }
  }

  // Hard delete — cascades to all related records via Prisma schema
  await db.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ success: true });
}
