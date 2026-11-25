import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  id: z.string().min(1),
  type: z.enum(["transaction", "weddingItem", "housingOption"]),
});

export async function GET() {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const [transactions, items, housing] = await Promise.all([
    prisma.transaction.findMany({ where: { householdId: member.householdId, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
    prisma.weddingItem.findMany({ where: { householdId: member.householdId, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
    prisma.housingOption.findMany({ where: { householdId: member.householdId, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
  ]);
  return NextResponse.json({ transactions, items, housing });
}

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Élément de corbeille invalide." }, { status: 400 });
  const { id, type } = parsed.data;
  const record = type === "transaction"
    ? await prisma.transaction.findFirst({ where: { id, householdId: member.householdId, deletedAt: { not: null } } })
    : type === "weddingItem"
      ? await prisma.weddingItem.findFirst({ where: { id, householdId: member.householdId, deletedAt: { not: null } } })
      : await prisma.housingOption.findFirst({ where: { id, householdId: member.householdId, deletedAt: { not: null } } });
  if (!record) return NextResponse.json({ error: "Élément introuvable dans la corbeille." }, { status: 404 });
  if (type === "transaction") await prisma.transaction.update({ where: { id }, data: { deletedAt: null } });
  else if (type === "weddingItem") await prisma.weddingItem.update({ where: { id }, data: { deletedAt: null } });
  else await prisma.housingOption.update({ where: { id }, data: { deletedAt: null } });
  await writeActivity({
    householdId: member.householdId,
    actorId: member.userId,
    action: "a restauré un élément de la corbeille",
    entityType: type,
    entityId: id,
  });
  return NextResponse.json({ success: true });
}
