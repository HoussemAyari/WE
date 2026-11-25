"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    try {
      const result = await authClient.requestPasswordReset({
        email: String(formData.get("email")),
        redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
      });
      if (result.error) {
        setError("La demande n’a pas pu être traitée. Réessayez plus tard.");
        setBusy(false);
        return;
      }
    } catch {
      setError("La demande n’a pas pu être traitée. Réessayez plus tard.");
      setBusy(false);
      return;
    }
    setMessage("Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.");
    setBusy(false);
  }

  return (
    <main className="login-page">
      <section className="login-art">
        <Link className="auth-brand" href="/"><span className="brand-mark">∞</span> DeuxNous</Link>
        <div className="login-art-copy"><div className="eyebrow" style={{ color: "#dce1d2" }}>Votre espace privé</div><h1>Retrouvons le bon chemin.</h1><p>Un lien temporaire vous permettra de choisir un nouveau mot de passe.</p></div>
        <div className="login-quote">Vos projets restent entre vos mains.</div>
      </section>
      <section className="login-card-wrap">
        <div className="login-card">
          <div className="eyebrow">Récupération du compte</div>
          <h2>Mot de passe oublié ?</h2>
          <p>Indiquez l’adresse e-mail associée à votre compte.</p>
          {error && <div className="error-banner" role="alert">{error}</div>}
          {message && <div className="success-banner" role="status">{message}</div>}
          <form className="login-form" onSubmit={(event) => void submit(event)}>
            <div className="form-field"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.tn" /></div>
            <button className="button-primary" disabled={busy}>{busy ? "Envoi…" : "Envoyer le lien"}</button>
          </form>
          <div className="login-switch"><Link className="text-link" href="/connexion">Retour à la connexion</Link></div>
        </div>
      </section>
    </main>
  );
}
