import { Opinion } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({
  opinion: z.nativeEnum(Opinion),
  score: z.coerce.number().int().min(1).max(5).nullable().optional(),
  comment: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Avis invalide." }, { status: 400 });
  const { id } = await params;
  try {
    const item = await prisma.weddingItem.findFirst({ where: { id, householdId: member.householdId, deletedAt: null } });
    if (!item) return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
    const before = await prisma.itemReview.findUnique({ where: { itemId_userId: { itemId: id, userId: member.userId } } });
    const review = await prisma.itemReview.upsert({
      where: { itemId_userId: { itemId: id, userId: member.userId } },
      create: { itemId: id, userId: member.userId, ...parsed.data },
      update: parsed.data,
      include: { author: { select: { id: true, name: true } } },
    });
    await writeActivity({ householdId: member.householdId, actorId: member.userId, action: "a donné son avis sur un élément", entityType: "itemReview", entityId: review.id, before, after: review });
    return NextResponse.json({ review });
  } catch (error) {
    return jsonError(error);
  }
}
