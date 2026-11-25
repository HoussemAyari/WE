"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const token = new URLSearchParams(window.location.search).get("token");
    const formData = new FormData(event.currentTarget);
    if (!token) {
      setError("Ce lien est invalide ou a expiré. Demandez-en un nouveau.");
      setBusy(false);
      return;
    }
    try {
      const result = await authClient.resetPassword({
        token,
        newPassword: String(formData.get("password")),
      });
      if (result.error) {
        setError("Ce lien est invalide ou a expiré. Demandez-en un nouveau.");
        setBusy(false);
        return;
      }
    } catch {
      setError("Ce lien est invalide ou a expiré. Demandez-en un nouveau.");
      setBusy(false);
      return;
    }
    router.replace("/connexion?mot-de-passe-modifie=1");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-art">
        <Link className="auth-brand" href="/"><span className="brand-mark">∞</span> DeuxNous</Link>
        <div className="login-art-copy"><div className="eyebrow" style={{ color: "#dce1d2" }}>Votre espace privé</div><h1>Un nouveau départ, en toute sécurité.</h1><p>Choisissez un mot de passe solide et gardez le contrôle de votre compte.</p></div>
        <div className="login-quote">Un lien à usage limité, envoyé uniquement à votre adresse.</div>
      </section>
      <section className="login-card-wrap">
        <div className="login-card">
          <div className="eyebrow">Sécurisez votre compte</div>
          <h2>Nouveau mot de passe</h2>
          <p>Le mot de passe doit contenir au moins 10 caractères.</p>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <form className="login-form" onSubmit={(event) => void submit(event)}>
            <div className="form-field"><label htmlFor="password">Nouveau mot de passe</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></div>
            <button className="button-primary" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le mot de passe"}</button>
          </form>
          <div className="login-switch"><Link className="text-link" href="/connexion">Retour à la connexion</Link></div>
        </div>
      </section>
    </main>
  );
}
