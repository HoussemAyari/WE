"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Heart, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      redirect: false,
    });
    if (result?.error) {
      setError("Adresse e-mail ou mot de passe incorrect.");
      setBusy(false);
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
          <div className="eyebrow" style={{ color: "#dce1d2" }}>À deux, sereinement</div>
          <h1>Construire votre vie commune, un choix à la fois.</h1>
          <p>Un espace doux et privé pour suivre vos dépenses, préparer votre mariage et décider ensemble.</p>
        </div>
        <div className="login-quote">« Les petits pas font les grands projets. »</div>
      </section>
      <section className="login-card-wrap">
        <div className="login-card">
          <div className="eyebrow">Votre espace privé</div>
          <h2>Ravi de vous retrouver.</h2>
          <p>Connectez-vous pour retrouver votre foyer à deux.</p>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <form className="login-form" onSubmit={submit}>
            <div className="form-field"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.tn" /></div>
            <div className="form-field"><label htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Votre mot de passe" /></div>
            <button className="button-primary" disabled={busy}>{busy ? "Connexion…" : "Se connecter"} <Heart size={15} /></button>
          </form>
          <div className="login-switch">Pas encore de compte ? <Link className="text-link" href="/inscription">Créer votre espace</Link></div>
          <div className="install-note"><ShieldCheck size={16} /> Vos données sont isolées dans votre foyer. Seuls ses membres peuvent les consulter.</div>
        </div>
      </section>
    </main>
  );
}
