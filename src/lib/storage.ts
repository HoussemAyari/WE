import { createClient } from "@supabase/supabase-js";

export function privateStorage() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !serviceKey || !bucket) throw new Error("Le stockage privé Supabase n’est pas configuré.");
  return { client: createClient(url, serviceKey, { auth: { persistSession: false } }), bucket };
}
