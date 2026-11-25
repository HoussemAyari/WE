import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/connexion");
  return <AppShell userId={session.user.id} userName={session.user.name || session.user.email || "Vous"} />;
}
