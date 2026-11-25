import { NextResponse } from "next/server";
import { currentMember, forbidden, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const activities = await prisma.activityLog.findMany({
    where: { householdId: member.householdId },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ activities });
}
