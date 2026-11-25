import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentMember, forbidden, jsonError, unauthorized, writeActivity } from "@/lib/api";
import { privateStorage } from "@/lib/storage";
import { prisma } from "@/lib/db";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
]);

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return unauthorized();
  if (!member.household) return forbidden();
  const formData = await request.formData();
  const body = String(formData.get("body") || "").trim();
  const itemId = String(formData.get("itemId") || "") || null;
  const file = formData.get("photo");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size > MAX_FILE_SIZE || body.length > 2000) {
    return NextResponse.json({ error: "Choisissez une image JPEG, PNG, WebP ou HEIC de 4 Mo maximum." }, { status: 400 });
  }
  if (itemId && !(await prisma.weddingItem.findFirst({ where: { id: itemId, householdId: member.householdId, deletedAt: null }, select: { id: true } }))) {
    return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
  }
  let fileKey: string | null = null;
  let storage: ReturnType<typeof privateStorage> | null = null;
  let messageCreated = false;
  try {
    storage = privateStorage();
    fileKey = `${member.householdId}/messages/${randomUUID()}.${allowedTypes.get(file.type)}`;
    const { error } = await storage.client.storage.from(storage.bucket).upload(fileKey, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const message = await prisma.message.create({
      data: { householdId: member.householdId, authorId: member.userId, itemId, body, imageKey: fileKey },
      include: { author: { select: { id: true, name: true } } },
    });
    messageCreated = true;
    await writeActivity({ householdId: member.householdId, actorId: member.userId, action: "a partagé une photo dans la discussion", entityType: "message", entityId: message.id });
    return NextResponse.json({ message: { ...message, imageUrl: `/api/messages/${message.id}/image`, imageKey: undefined } }, { status: 201 });
  } catch (error) {
    if (storage && fileKey && !messageCreated) {
      const cleanup = await storage.client.storage.from(storage.bucket).remove([fileKey]);
      if (cleanup.error) console.error("Échec du nettoyage de la photo Supabase.", cleanup.error);
    }
    return jsonError(error);
  }
}
