/**
 * POST /api/scan — Triggers a full OSINT scan for the authenticated user's identity profile.
 * GET  /api/scan — Returns the latest scan results.
 *
 * Scans are run in-process for now. For production at scale, move the
 * runFullScan call to a background job queue (e.g. Inngest, BullMQ, or
 * Vercel Cron) and return a job ID that the client polls.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { runFullScan } from "@/lib/scanner/scan-orchestrator";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profile = await db.identityProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "Identity profile not found." }, { status: 404 });
  }

  try {
    // Wrap the full scan in a 3-minute hard timeout to prevent indefinite hangs.
    const scanPromise = runFullScan(profile.id, session.user.id);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Scan timed out after 3 minutes.")),
        3 * 60 * 1000
      )
    );

    const result = await Promise.race([scanPromise, timeoutPromise]);

    return NextResponse.json({
      success: true,
      riskScore: result.riskScore,
      summary: {
        breachCount: result.breachCount,
        impersonatorCount: result.impersonatorCount,
        lookalikeDomainCount: result.lookalikeDomainCount,
        darkWebHits: result.darkWebHits,
        piiExposureCount: result.piiExposureCount,
        totalFindings: result.findings.length,
      },
      completedAt: result.completedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    console.error("[SCAN POST] Scan failed:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profile = await db.identityProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      securityFindings: {
        where: { isResolved: false },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      },
      impersonations: {
        where: { status: "PENDING_REVIEW" },
        orderBy: [{ confidenceScore: "desc" }, { reportedAt: "desc" }],
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json({
    riskScore: profile.riskScore,
    lastAuditedAt: profile.lastAuditedAt,
    findings: profile.securityFindings,
    impersonations: profile.impersonations,
  });
}
