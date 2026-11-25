import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  monthlyCap: z.coerce.number().nonnegative().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Budget ou catégorie invalide." }, { status: 400 });
  const { id } = await params;
  try {
    const before = await prisma.budgetCategory.findFirst({ where: { id, householdId: member.householdId } });
    if (!before) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
    const category = await prisma.budgetCategory.update({ where: { id }, data: parsed.data });
    await writeActivity({
      householdId: member.householdId, actorId: member.userId, action: "a modifié un budget de catégorie",
      entityType: "budgetCategory", entityId: id, before, after: category,
    });
    return NextResponse.json({ category });
  } catch (error) {
    return jsonError(error);
  }
}
