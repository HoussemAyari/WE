import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(1).max(40),
  monthlyCap: z.coerce.number().nonnegative().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET() {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const categories = await prisma.budgetCategory.findMany({
    where: { householdId: member.householdId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
  try {
    const category = await prisma.budgetCategory.create({
      data: { ...parsed.data, householdId: member.householdId },
    });
    await writeActivity({
      householdId: member.householdId,
      actorId: member.userId,
      action: "a ajouté une catégorie de budget",
      entityType: "budgetCategory",
      entityId: category.id,
      after: category,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
