import { NextResponse } from "next/server";
import { currentMember, forbidden, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

function csvCell(value: unknown) {
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "");
  const text = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const entries = await prisma.transaction.findMany({
    where: { householdId: member.householdId, deletedAt: null },
    include: {
      author: { select: { name: true, email: true } },
      owner: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  });
  const rows = [
    ["Date", "Type", "Montant", "Devise", "Catégorie", "Pour", "Note", "Moyen de paiement", "Saisi par"],
    ...entries.map((entry) => [
      entry.date,
      entry.type === "INCOME" ? "Revenu" : "Dépense",
      entry.amount.toString(),
      member.household.currencyCode,
      entry.category,
      entry.owner?.name || "Commun",
      entry.note,
      entry.paymentMethod,
      entry.author.name || entry.author.email,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="deux-nous-transactions.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
