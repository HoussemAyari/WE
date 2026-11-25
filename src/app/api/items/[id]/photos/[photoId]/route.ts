import { NextResponse } from "next/server";
import { currentMember, forbidden, unauthorized } from "@/lib/api";
import { privateStorage } from "@/lib/storage";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const { id, photoId } = await params;
  const photo = await prisma.itemPhoto.findFirst({
    where: { id: photoId, itemId: id, item: { householdId: member.householdId, deletedAt: null } },
  });
  if (!photo) return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
  try {
    const { client, bucket } = privateStorage();
    const { data, error } = await client.storage.from(bucket).download(photo.fileKey);
    if (error) throw error;
    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Impossible de charger cette photo." }, { status: 500 });
  }
}
