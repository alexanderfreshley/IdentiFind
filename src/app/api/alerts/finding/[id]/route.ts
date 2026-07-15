import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

const actionSchema = z.object({
  action: z.enum(["resolve", "dismiss"]),
});

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

  // Verify the finding belongs to this user
  const finding = await db.securityFinding.findUnique({
    where: { id },
    include: { identityProfile: true },
  });

  if (!finding || finding.identityProfile.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.securityFinding.update({
    where: { id },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
    },
  });

  await logAuditEvent({
    userId: session.user.id,
    action: AUDIT_ACTIONS.FINDING_RESOLVED,
    resource: "securityFinding",
    resourceId: id,
    metadata: { action: parsed.data.action },
  });

  return NextResponse.json({ success: true });
}
