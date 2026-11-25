import { EntryType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  type: z.nativeEnum(EntryType),
  amount: z.coerce.number().positive().max(99999999999.999),
  ownerId: z.string().nullable().optional(),
  category: z.string().trim().min(1).max(60),
  date: z.string().datetime().optional(),
  note: z.string().trim().max(500).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).optional(),
});

function addFrequency(date: Date, frequency: string) {
  const next = new Date(date);
  if (frequency === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  const originalDay = next.getUTCDate();
  next.setUTCDate(1);
  if (frequency === "YEARLY") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(originalDay, lastDay));
  return next;
}

export async function GET(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type");
  const entries = await prisma.transaction.findMany({
    where: {
      householdId: member.householdId,
      deletedAt: null,
      ...(type === "INCOME" || type === "EXPENSE" ? { type } : {}),
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) } } : {}),
    },
    include: {
      author: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Montant, type ou catégorie invalide." }, { status: 400 });
  try {
    if (parsed.data.ownerId && !(await prisma.householdMember.findFirst({
      where: { householdId: member.householdId, userId: parsed.data.ownerId },
      select: { id: true },
    }))) {
      return NextResponse.json({ error: "Cette personne ne fait pas partie de votre foyer." }, { status: 400 });
    }
    const { frequency, ...transactionData } = parsed.data;
    const entryDate = transactionData.date ? new Date(transactionData.date) : new Date();
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          ...transactionData,
          amount: transactionData.amount,
          date: entryDate,
          householdId: member.householdId,
          authorId: member.userId,
          ownerId: transactionData.ownerId || null,
        },
        include: { author: { select: { id: true, name: true } } },
      });
      if (frequency) {
        await tx.recurringRule.create({
          data: {
            householdId: member.householdId,
            authorId: member.userId,
            ownerId: transactionData.ownerId || null,
            type: transactionData.type,
            amount: transactionData.amount,
            category: transactionData.category,
            note: transactionData.note,
            frequency,
            nextDate: addFrequency(entryDate, frequency),
          },
        });
      }
      return created;
    });
    await writeActivity({
      householdId: member.householdId,
      actorId: member.userId,
      action: `a ajouté ${entry.type === "EXPENSE" ? "une dépense" : "un revenu"}`,
      entityType: "transaction",
      entityId: entry.id,
      after: entry,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
