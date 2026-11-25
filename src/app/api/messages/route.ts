import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({ body: z.string().trim().min(1).max(2000), itemId: z.string().nullable().optional() });

export async function GET(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  if (itemId) {
    const item = await prisma.weddingItem.findFirst({ where: { id: itemId, householdId: member.householdId }, select: { id: true } });
    if (!item) return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
  }
  const messages = await prisma.message.findMany({
    where: { householdId: member.householdId, itemId: itemId || null },
    select: {
      id: true, householdId: true, authorId: true, itemId: true, body: true, imageKey: true, createdAt: true,
      author: { select: { id: true, name: true } },
      reads: { where: { userId: member.userId }, select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadIds = messages.filter((message) => message.authorId !== member.userId && message.reads.length === 0).map((message) => message.id);
  if (unreadIds.length) {
    await prisma.messageRead.createMany({ data: unreadIds.map((messageId) => ({ messageId, userId: member.userId })), skipDuplicates: true });
  }
  return NextResponse.json({
    messages: messages.reverse().map((message) => ({
      id: message.id,
      itemId: message.itemId,
      body: message.body,
      imageUrl: message.imageKey ? `/api/messages/${message.id}/image` : null,
      createdAt: message.createdAt,
      author: message.author,
    })),
  });
}

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message vide ou trop long." }, { status: 400 });
  try {
    if (parsed.data.itemId) {
      const item = await prisma.weddingItem.findFirst({ where: { id: parsed.data.itemId, householdId: member.householdId, deletedAt: null }, select: { id: true } });
      if (!item) return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
    }
    const message = await prisma.message.create({
      data: { householdId: member.householdId, authorId: member.userId, ...parsed.data, itemId: parsed.data.itemId || null },
      include: { author: { select: { id: true, name: true } } },
    });
    await writeActivity({ householdId: member.householdId, actorId: member.userId, action: "a envoyé un message", entityType: "message", entityId: message.id, after: message });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
