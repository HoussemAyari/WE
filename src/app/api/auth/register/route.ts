import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
  invitationToken: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez les champs. Le mot de passe doit contenir au moins 10 caractères." }, { status: 400 });
  const { name, email, password, invitationToken } = parsed.data;
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "Cette adresse e-mail est déjà inscrite." }, { status: 409 });
  }
  const invitation = invitationToken
    ? await prisma.householdInvite.findUnique({ where: { token: invitationToken } })
    : null;
  if (invitationToken && (!invitation || invitation.expiresAt < new Date() || (invitation.email && invitation.email !== email))) {
    return NextResponse.json({ error: "Cette invitation est invalide ou a expiré." }, { status: 400 });
  }
  if (invitation && (await prisma.householdMember.count({ where: { householdId: invitation.householdId } })) >= 2) {
    return NextResponse.json({ error: "Ce foyer a déjà ses deux membres." }, { status: 409 });
  }
  const passwordHash = await hash(password, 12);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name, email, passwordHash } });
      if (invitation) {
        await tx.householdMember.create({ data: { householdId: invitation.householdId, userId: created.id } });
        await tx.householdInvite.delete({ where: { id: invitation.id } });
        await tx.activityLog.create({
          data: { householdId: invitation.householdId, actorId: created.id, action: "a rejoint le foyer", entityType: "household", entityId: invitation.householdId },
        });
      } else {
        const household = await tx.household.create({
          data: { name: `Foyer de ${name}`, members: { create: { userId: created.id, role: "OWNER" } } },
        });
        await tx.budgetCategory.createMany({
          data: ["Alimentation", "Transport", "Logement", "Loisirs", "Santé", "Cigarettes", "Autre"].map((category) => ({
            householdId: household.id,
            name: category,
          })),
          skipDuplicates: true,
        });
        await tx.activityLog.create({
          data: { householdId: household.id, actorId: created.id, action: "a créé le foyer", entityType: "household", entityId: household.id },
        });
      }
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Création du compte impossible. Réessayez." }, { status: 500 });
  }
}
