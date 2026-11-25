import { ItemPriority, ItemStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  estimatedAmount: z.coerce.number().nonnegative().optional(),
  actualAmount: z.coerce.number().nonnegative().optional(),
  depositAmount: z.coerce.number().nonnegative().optional(),
  url: z.string().url().optional().or(z.literal("")),
  storeName: z.string().trim().max(120).optional(),
  status: z.nativeEnum(ItemStatus).optional(),
  priority: z.nativeEnum(ItemPriority).optional(),
  dueDate: z.string().datetime().optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function GET(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const { searchParams } = new URL(request.url);
  const decisionOnly = searchParams.get("decision") === "1";
  const items = await prisma.weddingItem.findMany({
    where: { householdId: member.householdId, deletedAt: null },
    include: {
      reviews: { include: { author: { select: { id: true, name: true } } } },
      photos: { select: { id: true, filename: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
  const filtered = decisionOnly
    ? items.filter((item) => item.reviews.length < member.household.members.length || new Set(item.reviews.map((review) => review.opinion)).size > 1)
    : items;
  return NextResponse.json({ items: filtered });
}

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez le nom, la catégorie et les montants." }, { status: 400 });
  try {
    const { dueDate, ...data } = parsed.data;
    const item = await prisma.weddingItem.create({
      data: { ...data, url: data.url || null, dueDate: dueDate ? new Date(dueDate) : null, householdId: member.householdId },
      include: { reviews: true, photos: true },
    });
    await writeActivity({
      householdId: member.householdId,
      actorId: member.userId,
      action: "a ajouté un élément de préparation",
      entityType: "weddingItem",
      entityId: item.id,
      after: item,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
