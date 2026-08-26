/**
 * DELETE /api/accounts/[id]  — Disconnect (soft-delete) a social account.
 * POST   /api/accounts/[id]  — Re-sync / refresh security metadata for an account.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

// ─── Helper: verify ownership ────────────────────────────────────────────────
async function getOwnedAccount(accountId: string, userId: string) {
  const account = await db.socialAccount.findUnique({
    where: { id: accountId },
    include: { identityProfile: true },
  });
  if (!account || account.identityProfile.userId !== userId) return null;
  return account;
}

// ─── DELETE — disconnect account ─────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const account = await getOwnedAccount(id, session.user.id);
  if (!account) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Soft-delete: mark inactive rather than hard delete, preserving audit history
  await db.socialAccount.update({
    where: { id },
    data: { isActive: false },
  });

  await logAuditEvent({
    userId: session.user.id,
    action: AUDIT_ACTIONS.ACCOUNT_DISCONNECT,
    resource: "socialAccount",
    resourceId: id,
    metadata: { platform: account.platform, username: account.username },
  });

  return NextResponse.json({ success: true });
}

// ─── POST — sync / refresh account metadata ──────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const account = await getOwnedAccount(id, session.user.id);
  if (!account) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Update lastSyncedAt to now.
  // In a future iteration this would re-fetch OAuth metadata for the platform.
  await db.socialAccount.update({
    where: { id },
    data: { lastSyncedAt: new Date() },
  });

  await logAuditEvent({
    userId: session.user.id,
    action: AUDIT_ACTIONS.PROFILE_VIEW,   // closest existing action; swap for ACCOUNT_SYNC when added
    resource: "socialAccount",
    resourceId: id,
    metadata: { platform: account.platform, username: account.username, event: "sync" },
  });

  return NextResponse.json({ success: true, syncedAt: new Date().toISOString() });
}
