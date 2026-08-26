import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

const addAccountSchema = z.object({
  platform: z.enum([
    "INSTAGRAM", "TWITTER_X", "FACEBOOK", "LINKEDIN",
    "TIKTOK", "YOUTUBE", "REDDIT", "GITHUB", "DISCORD",
  ]),
  profileId: z.string().cuid(),
  username: z.string().min(1).max(100).trim(),
  profileUrl: z.string().url().nullable().optional(),
  mfaEnabled: z.boolean().nullable().optional(),
  emailVerified: z.boolean().nullable().optional(),
  phoneVerified: z.boolean().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = addAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { platform, profileId, username, profileUrl, mfaEnabled, emailVerified, phoneVerified } = parsed.data;

    // Verify the profile belongs to the current user
    const profile = await db.identityProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== session.user.id) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    // Check for duplicate
    const existing = await db.socialAccount.findFirst({
      where: {
        identityProfileId: profileId,
        platform,
        username: { equals: username, mode: "insensitive" },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A ${platform} account with this username is already connected.` },
        { status: 409 }
      );
    }

    const account = await db.socialAccount.create({
      data: {
        identityProfileId: profileId,
        platform,
        platformUserId: username, // placeholder until OAuth flow provides real ID
        username,
        profileUrl: profileUrl ?? null,
        mfaEnabled: mfaEnabled ?? null,
        emailVerified: emailVerified ?? null,
        phoneVerified: phoneVerified ?? null,
      },
    });

    await logAuditEvent({
      userId: session.user.id,
      action: AUDIT_ACTIONS.ACCOUNT_CONNECT,
      resource: "socialAccount",
      resourceId: account.id,
      metadata: { platform, username },
    });

    return NextResponse.json({ id: account.id }, { status: 201 });
  } catch (error) {
    console.error("[ACCOUNTS POST]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
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
      socialAccounts: {
        where: { isActive: true },
        orderBy: { connectedAt: "asc" },
      },
    },
  });

  return NextResponse.json({
    accounts: profile?.socialAccounts ?? [],
  });
}
