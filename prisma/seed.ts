import { PrismaClient, EntryType, ItemStatus, ItemPriority, Opinion } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Définissez DEMO_USER_EMAIL après avoir créé et vérifié le compte de démonstration.");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.emailVerified) throw new Error("Le compte de démonstration doit exister et avoir une adresse vérifiée.");
  const membership = await prisma.householdMember.findUnique({ where: { userId: user.id } });
  if (!membership) throw new Error("Le compte de démonstration doit déjà appartenir à un foyer.");
  const householdId = membership.householdId;
  await prisma.budgetCategory.createMany({
    data: [
      { householdId, name: "Alimentation", monthlyCap: 500, color: "#8f9b72" },
      { householdId, name: "Transport", monthlyCap: 250, color: "#c89068" },
      { householdId, name: "Cigarettes", monthlyCap: 120, color: "#b86f69" },
      { householdId, name: "Logement", monthlyCap: 900, color: "#778c96" },
    ],
    skipDuplicates: true,
  });
  const transactionCount = await prisma.transaction.count({ where: { householdId } });
  if (transactionCount === 0) {
    await prisma.transaction.createMany({
      data: [
        { householdId, authorId: user.id, type: EntryType.INCOME, amount: 2400, category: "Salaire", note: "Salaire mensuel" },
        { householdId, authorId: user.id, type: EntryType.EXPENSE, amount: 42.5, category: "Alimentation", note: "Marché central" },
        { householdId, authorId: user.id, type: EntryType.EXPENSE, amount: 8, category: "Cigarettes", note: "Paquet" },
        { householdId, authorId: user.id, type: EntryType.EXPENSE, amount: 65, category: "Transport", note: "Essence" },
      ],
    });
  }
  const itemCount = await prisma.weddingItem.count({ where: { householdId } });
  if (itemCount === 0) {
    const item = await prisma.weddingItem.create({
      data: {
        householdId,
        title: "Salle de réception",
        category: "Lieu",
        estimatedAmount: 1800,
        status: ItemStatus.COMPARING,
        priority: ItemPriority.HIGH,
        note: "Comparer les disponibilités de juin",
      },
    });
    await prisma.itemReview.create({
      data: { itemId: item.id, userId: user.id, opinion: Opinion.LIKE, score: 4, comment: "Jardin superbe" },
    });
  }
  console.log(`Seed prêt. Connexion: ${email} / DemoCouple2026!`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
