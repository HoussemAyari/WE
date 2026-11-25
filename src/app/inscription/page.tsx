"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    const invitationToken = new URLSearchParams(window.location.search).get("invitation") || undefined;
    try {
      const result = await authClient.signUp.email({
        name: String(formData.get("name")),
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        callbackURL: `${window.location.origin}/connexion`,
        ...(invitationToken ? { pendingInvitationToken: invitationToken } : {}),
      });
      if (result.error) {
        setError("La création du compte a échoué. Vérifiez vos informations et réessayez.");
        setBusy(false);
        return;
      }
    } catch {
      setError("La création du compte a échoué. Vérifiez vos informations et réessayez.");
      setBusy(false);
      return;
    }
    setSuccess("Vérifiez votre boîte e-mail pour confirmer votre adresse avant de vous connecter.");
    setBusy(false);
  }

  async function signUpWithGoogle() {
    setBusy(true);
    setError("");
    const invitationToken = new URLSearchParams(window.location.search).get("invitation");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        newUserCallbackURL: "/",
        ...(invitationToken ? { additionalData: { pendingInvitationToken: invitationToken } } : {}),
      });
      if (!result.error) return;
      setError("La création du compte Google n’a pas abouti. Réessayez.");
      setBusy(false);
    } catch {
      setError("La création du compte Google n’a pas abouti. Réessayez.");
      setBusy(false);
    }
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
          {success && <div className="success-banner" role="status">{success}</div>}
          <form className="login-form" onSubmit={(event) => void submit(event)}>
            <div className="form-field"><label htmlFor="name">Votre prénom</label><input id="name" name="name" autoComplete="given-name" required maxLength={80} placeholder="Amira" /></div>
            <div className="form-field"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.tn" /></div>
            <div className="form-field"><label htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required placeholder="10 caractères minimum" /></div>
            <button className="button-primary" disabled={busy}>{busy ? "Création…" : "Créer mon espace"} <Heart size={15} /></button>
          </form>
          <div className="auth-divider"><span>ou</span></div>
          <button className="auth-social-button" type="button" disabled={busy} onClick={() => void signUpWithGoogle()}><span className="google-mark" aria-hidden="true">G</span> Continuer avec Google</button>
          <div className="login-switch">Déjà inscrit(e) ? <Link className="text-link" href="/connexion">Se connecter</Link></div>
          <div className="install-note"><ShieldCheck size={16} /> Vos données personnelles sont protégées et ne sont jamais partagées hors de votre foyer.</div>
        </div>
      </section>
    </main>
  );
}
