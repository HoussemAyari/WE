import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { privateStorage } from "@/lib/storage";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
]);

export async function POST(request: Request, { params }: RouteContext) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const { id } = await params;
  const item = await prisma.weddingItem.findFirst({ where: { id, householdId: member.householdId, deletedAt: null } });
  if (!item) return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Choisissez une image (JPEG, PNG, WebP ou HEIC) de 4 Mo maximum." }, { status: 400 });
  }
  let fileKey: string | null = null;
  let storage: ReturnType<typeof privateStorage> | null = null;
  let photoCreated = false;
  try {
    storage = privateStorage();
    fileKey = `${member.householdId}/${id}/${randomUUID()}.${allowedTypes.get(file.type)}`;
    const { error } = await storage.client.storage.from(storage.bucket).upload(fileKey, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const photo = await prisma.itemPhoto.create({ data: { itemId: id, fileKey, filename: file.name } });
    photoCreated = true;
    await writeActivity({ householdId: member.householdId, actorId: member.userId, action: "a ajouté une photo", entityType: "itemPhoto", entityId: photo.id });
    return NextResponse.json({ photo: { id: photo.id, filename: photo.filename } }, { status: 201 });
  } catch (error) {
    if (storage && fileKey && !photoCreated) {
      const cleanup = await storage.client.storage.from(storage.bucket).remove([fileKey]);
      if (cleanup.error) console.error("Échec du nettoyage de la photo Supabase.", cleanup.error);
    }
    return jsonError(error);
  }
}
