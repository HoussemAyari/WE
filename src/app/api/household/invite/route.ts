import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({ email: z.string().email().optional() });

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  if (member.household.members.length >= 2) {
    return NextResponse.json({ error: "Votre foyer a déjà deux membres." }, { status: 409 });
  }
  try {
    const invite = await prisma.householdInvite.upsert({
      where: { householdId: member.householdId },
      create: {
        householdId: member.householdId,
        token: randomBytes(32).toString("base64url"),
        email: parsed.data.email?.toLowerCase(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        token: randomBytes(32).toString("base64url"),
        email: parsed.data.email?.toLowerCase(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await writeActivity({
      householdId: member.householdId,
      actorId: member.userId,
      action: "a créé un lien d’invitation",
      entityType: "householdInvite",
      entityId: invite.id,
    });
    return NextResponse.json({ inviteUrl: `${new URL(request.url).origin}/inscription?invitation=${invite.token}`, expiresAt: invite.expiresAt });
  } catch (error) {
    return jsonError(error);
  }
}
