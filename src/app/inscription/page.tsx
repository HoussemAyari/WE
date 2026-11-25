"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Heart, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        invitationToken: new URLSearchParams(window.location.search).get("invitation") || undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "La création du compte a échoué.");
      setBusy(false);
      return;
    }
    const login = await signIn("credentials", {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      redirect: false,
    });
    if (login?.error) {
      setError("Compte créé. Connectez-vous avec votre nouveau mot de passe.");
      setBusy(false);
      router.replace("/connexion");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-art">
        <Link className="auth-brand" href="/"><span className="brand-mark">∞</span> DeuxNous</Link>
        <div className="login-art-copy">
          <div className="eyebrow" style={{ color: "#dce1d2" }}>Un nouveau chapitre</div>
          <h1>Vos projets prennent vie à deux.</h1>
          <p>Créez un espace privé, puis invitez votre partenaire avec un lien sécurisé valable sept jours.</p>
        </div>
        <div className="login-quote">Un compte chacun. Un foyer partagé. Toujours ensemble.</div>
      </section>
      <section className="login-card-wrap">
        <div className="login-card">
          <div className="eyebrow">Commencez ici</div>
          <h2>Créons votre espace.</h2>
          <p>Votre compte ouvrira un foyer que vous pourrez partager, ou rejoindra votre partenaire si vous suivez son invitation.</p>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <form className="login-form" onSubmit={submit}>
            <div className="form-field"><label htmlFor="name">Votre prénom</label><input id="name" name="name" autoComplete="given-name" required maxLength={80} placeholder="Amira" /></div>
            <div className="form-field"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.tn" /></div>
            <div className="form-field"><label htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required placeholder="10 caractères minimum" /></div>
            <button className="button-primary" disabled={busy}>{busy ? "Création…" : "Créer mon espace"} <Heart size={15} /></button>
          </form>
          <div className="login-switch">Déjà inscrit(e) ? <Link className="text-link" href="/connexion">Se connecter</Link></div>
          <div className="install-note"><ShieldCheck size={16} /> Vos données personnelles sont protégées et ne sont jamais partagées hors de votre foyer.</div>
        </div>
      </section>
    </main>
  );
}
