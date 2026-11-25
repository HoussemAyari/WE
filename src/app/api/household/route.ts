import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

const householdSchema = z.object({ name: z.string().trim().min(1).max(80), currencyCode: z.enum(["TND", "EUR", "USD"]) });

export async function GET() {
  const member = await currentMember();
  if (!member) return unauthorized();
  return NextResponse.json({
    household: member.household,
    invite: await prisma.householdInvite.findUnique({ where: { householdId: member.householdId } }),
  });
}

export async function PATCH(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = householdSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informations du foyer invalides." }, { status: 400 });
  try {
    const before = { name: member.household.name, currencyCode: member.household.currencyCode };
    const household = await prisma.household.update({ where: { id: member.householdId }, data: parsed.data });
    await writeActivity({
      householdId: member.householdId,
      actorId: member.userId,
      action: "a modifié les paramètres du foyer",
      entityType: "household",
      entityId: household.id,
      before,
      after: parsed.data,
    });
    return NextResponse.json({ household });
  } catch (error) {
    return jsonError(error);
  }
}
