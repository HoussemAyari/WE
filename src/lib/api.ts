import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function currentMember() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.householdMember.findUnique({
    where: { userId: session.user.id },
    include: {
      household: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });
}

export function unauthorized() {
  return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Aucun foyer associé à ce compte." }, { status: 403 });
}

export async function writeActivity(input: {
  householdId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.activityLog.create({
    data: {
      ...input,
      before: input.before == null ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after == null ? undefined : JSON.parse(JSON.stringify(input.after)),
    },
  });
}

export function jsonError(error: unknown) {
  console.error(error);
  return NextResponse.json({ error: "Une erreur est survenue. Réessayez." }, { status: 500 });
}
