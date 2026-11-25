import { NextResponse } from "next/server";
import { currentMember, forbidden, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const count = await prisma.message.count({
    where: { householdId: member.householdId, authorId: { not: member.userId }, reads: { none: { userId: member.userId } } },
  });
  return NextResponse.json({ count });
}
