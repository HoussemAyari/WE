import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function nextOccurrence(date: Date, frequency: string) {
  const next = new Date(date);
  if (frequency === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "YEARLY") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const rules = await prisma.recurringRule.findMany({
    where: { active: true, nextDate: { lte: new Date() } },
    orderBy: { nextDate: "asc" },
    take: 100,
  });
  await prisma.loginThrottle.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  let created = 0;
  for (const rule of rules) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.recurringRule.findUnique({ where: { id: rule.id } });
      if (!current?.active || current.nextDate > new Date()) return;
      const transaction = await tx.transaction.create({
        data: {
          householdId: current.householdId,
          authorId: current.authorId,
          ownerId: current.ownerId,
          type: current.type,
          amount: current.amount,
          category: current.category,
          note: current.note,
          date: current.nextDate,
        },
      });
      const nextDate = nextOccurrence(current.nextDate, current.frequency);
      await tx.recurringRule.update({ where: { id: current.id }, data: { nextDate } });
      await tx.activityLog.create({
        data: {
          householdId: current.householdId,
          actorId: current.authorId,
          action: "a généré une opération récurrente",
          entityType: "transaction",
          entityId: transaction.id,
          after: { id: transaction.id, amount: transaction.amount.toString(), category: transaction.category, date: transaction.date.toISOString() },
        },
      });
      created += 1;
    }, { isolationLevel: "Serializable" });
  }
  return NextResponse.json({ created });
}
