import { NextResponse } from "next/server";
import { z } from "zod";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  rent: z.coerce.number().nonnegative(),
  charges: z.coerce.number().nonnegative().optional(),
  deposit: z.coerce.number().nonnegative().optional(),
  areaM2: z.coerce.number().positive().optional(),
  neighborhood: z.string().trim().max(100).optional(),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  pros: z.string().trim().max(1000).optional(),
  cons: z.string().trim().max(1000).optional(),
  visitDate: z.string().datetime().optional(),
});

export async function GET() {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const options = await prisma.housingOption.findMany({
    where: { householdId: member.householdId, deletedAt: null },
    include: { photos: { select: { id: true, filename: true } } },
    orderBy: { rent: "asc" },
  });
  return NextResponse.json({ options });
}

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Option logement invalide." }, { status: 400 });
  try {
    const { visitDate, ...data } = parsed.data;
    const option = await prisma.housingOption.create({
      data: { ...data, visitDate: visitDate ? new Date(visitDate) : null, householdId: member.householdId },
    });
    await writeActivity({ householdId: member.householdId, actorId: member.userId, action: "a ajouté une option de logement", entityType: "housingOption", entityId: option.id, after: option });
    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
