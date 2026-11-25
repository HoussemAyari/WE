import { EntryType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  type: z.nativeEnum(EntryType),
  amount: z.coerce.number().positive().max(99999999999.999),
  category: z.string().trim().min(1).max(60),
  note: z.string().trim().max(500).optional(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  nextDate: z.string().datetime(),
});

export async function GET() {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const rules = await prisma.recurringRule.findMany({
    where: { householdId: member.householdId },
    orderBy: { nextDate: "asc" },
  });
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Règle récurrente invalide." }, { status: 400 });
  try {
    const rule = await prisma.recurringRule.create({
      data: { ...parsed.data, nextDate: new Date(parsed.data.nextDate), householdId: member.householdId, authorId: member.userId },
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
