import { PrismaClient, EntryType, ItemStatus, ItemPriority, Opinion } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@deuxnous.tn";
  const passwordHash = await bcrypt.hash("DemoCouple2026!", 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name: "Amira", passwordHash },
  });
  const membership = await prisma.householdMember.findUnique({ where: { userId: user.id } });
  let householdId = membership?.householdId;
  if (!householdId) {
    const household = await prisma.household.create({
      data: {
        name: "Amira & Sami",
        currencyCode: "TND",
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    householdId = household.id;
  }
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
