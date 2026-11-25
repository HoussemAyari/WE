import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  amount: z.coerce.number().positive().max(99999999999.999).optional(),
  ownerId: z.string().nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  note: z.string().trim().max(500).nullable().optional(),
  paymentMethod: z.string().trim().max(40).nullable().optional(),
  date: z.string().datetime().optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
  const { id } = await params;
  try {
    if (parsed.data.ownerId && !(await prisma.householdMember.findFirst({
      where: { householdId: member.householdId, userId: parsed.data.ownerId },
      select: { id: true },
    }))) {
      return NextResponse.json({ error: "Cette personne ne fait pas partie de votre foyer." }, { status: 400 });
    }
    const before = await prisma.transaction.findFirst({ where: { id, householdId: member.householdId, deletedAt: null } });
    if (!before) return NextResponse.json({ error: "Opération introuvable." }, { status: 404 });
    const entry = await prisma.transaction.update({
      where: { id },
      data: { ...parsed.data, ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}) },
    });
    await writeActivity({ householdId: member.householdId, actorId: member.userId, action: "a modifié une opération", entityType: "transaction", entityId: id, before, after: entry });
    return NextResponse.json({ entry });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const { id } = await params;
  try {
    const before = await prisma.transaction.findFirst({ where: { id, householdId: member.householdId, deletedAt: null } });
    if (!before) return NextResponse.json({ error: "Opération introuvable." }, { status: 404 });
    await prisma.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeActivity({ householdId: member.householdId, actorId: member.userId, action: "a déplacé une opération dans la corbeille", entityType: "transaction", entityId: id, before });
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
