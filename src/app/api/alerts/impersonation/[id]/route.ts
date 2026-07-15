import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

const actionSchema = z.object({
  action: z.enum(["confirm", "report", "dismiss"]),
});

const STATUS_MAP = {
  confirm: "CONFIRMED",
  report: "REPORTED_TO_PLATFORM",
  dismiss: "DISMISSED",
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  // Verify ownership
  const alert = await db.impersonationAlert.findUnique({
    where: { id },
    include: { identityProfile: true },
  });

  if (!alert || alert.identityProfile.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.impersonationAlert.update({
    where: { id },
    data: {
      status: STATUS_MAP[parsed.data.action],
      reviewedAt: new Date(),
    },
  });

  await logAuditEvent({
    userId: session.user.id,
    action: AUDIT_ACTIONS.IMPERSONATION_REPORTED,
    resource: "impersonationAlert",
    resourceId: id,
    metadata: {
      action: parsed.data.action,
      platform: alert.platform,
      suspectedUsername: alert.suspectedUsername,
    },
  });

  return NextResponse.json({ success: true });
}
