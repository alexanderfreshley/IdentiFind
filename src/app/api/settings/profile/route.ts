/**
 * PATCH /api/settings/profile — Update the authenticated user's display name and/or avatar URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

const schema = z.object({
  name: z
    .string()
    .min(1, "Name must not be empty.")
    .max(80, "Name must be 80 characters or fewer.")
    .trim()
    .optional(),
  image: z
    .string()
    .url("Must be a valid URL.")
    .max(512)
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

  const { name, image } = parsed.data;
  if (name === undefined && image === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(image !== undefined && { image }),
    },
    select: { id: true, name: true, image: true },
  });

  await logAuditEvent({
    userId: session.user.id,
    action: AUDIT_ACTIONS.PROFILE_VIEW,
    resource: "user",
    resourceId: session.user.id,
    metadata: { event: "profile_update", fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ success: true, user: updated });
}
