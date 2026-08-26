import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { runSecurityAudit } from "@/lib/security-engine";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const profile = await db.identityProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  try {
    const results = await runSecurityAudit(profile.id);

    await logAuditEvent({
      userId: session.user.id,
      action: AUDIT_ACTIONS.SECURITY_AUDIT_RUN,
      resource: "identityProfile",
      resourceId: profile.id,
      metadata: results,
    });

    return NextResponse.redirect(
      new URL(`/security?audit=complete&score=${results.riskScore}`, req.url)
    );
  } catch (error) {
    console.error("[SECURITY AUDIT]", error);
    return NextResponse.redirect(
      new URL("/security?audit=error", req.url)
    );
  }
}
