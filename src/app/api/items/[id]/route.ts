import { ItemPriority, ItemStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  estimatedAmount: z.coerce.number().nonnegative().nullable().optional(),
  actualAmount: z.coerce.number().nonnegative().nullable().optional(),
  depositAmount: z.coerce.number().nonnegative().nullable().optional(),
  url: z.string().url().nullable().optional(),
  storeName: z.string().trim().max(120).nullable().optional(),
  status: z.nativeEnum(ItemStatus).optional(),
  priority: z.nativeEnum(ItemPriority).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
  const { id } = await params;
  try {
    const before = await prisma.weddingItem.findFirst({ where: { id, householdId: member.householdId, deletedAt: null } });
    if (!before) return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
    const { dueDate, ...data } = parsed.data;
    const item = await prisma.weddingItem.update({
      where: { id },
      data: { ...data, ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}) },
    });
    await writeActivity({ householdId: member.householdId, actorId: member.userId, action: "a modifié un élément de préparation", entityType: "weddingItem", entityId: id, before, after: item });
    return NextResponse.json({ item });
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
    const before = await prisma.weddingItem.findFirst({ where: { id, householdId: member.householdId, deletedAt: null } });
    if (!before) return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
    await prisma.weddingItem.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeActivity({ householdId: member.householdId, actorId: member.userId, action: "a déplacé un élément dans la corbeille", entityType: "weddingItem", entityId: id, before });
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
