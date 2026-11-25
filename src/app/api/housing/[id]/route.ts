import { NextResponse } from "next/server";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const { id } = await params;
  try {
    const before = await prisma.housingOption.findFirst({ where: { id, householdId: member.householdId, deletedAt: null } });
    if (!before) return NextResponse.json({ error: "Logement introuvable." }, { status: 404 });
    await prisma.housingOption.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeActivity({
      householdId: member.householdId,
      actorId: member.userId,
      action: "a déplacé un logement dans la corbeille",
      entityType: "housingOption",
      entityId: id,
      before,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
