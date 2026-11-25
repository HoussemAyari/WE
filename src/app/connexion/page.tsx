"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Heart, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    setShowResend(false);
    const formData = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        callbackURL: "/",
      });
      if (result.error) {
        setError("Adresse e-mail ou mot de passe incorrect, ou adresse non vérifiée.");
        setShowResend(true);
        setBusy(false);
        return;
      }
    } catch {
      setError("Connexion impossible pour le moment. Vérifiez votre réseau et réessayez.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      if (!result.error) return;
      setError("La connexion Google n’a pas abouti. Réessayez.");
      setBusy(false);
    } catch {
      setError("La connexion Google n’a pas abouti. Réessayez.");
      setBusy(false);
    }
  }

  async function resendVerification() {
    setError("");
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/connexion`,
      });
      if (result.error) {
        setError("Impossible d’envoyer le lien de vérification. Réessayez plus tard.");
        return;
      }
    } catch {
      setError("Impossible d’envoyer le lien de vérification. Réessayez plus tard.");
      return;
    }
    setSuccess("Si cette adresse correspond à un compte non vérifié, un nouveau lien vient d’être envoyé.");
    setShowResend(false);
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
          {success && <div className="success-banner" role="status">{success}</div>}
          <form className="login-form" onSubmit={submit}>
            <div className="form-field"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.tn" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="form-field"><label htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Votre mot de passe" /></div>
            <div className="auth-forgot"><Link className="text-link" href="/mot-de-passe-oublie">Mot de passe oublié ?</Link></div>
            <button className="button-primary" disabled={busy}>{busy ? "Connexion…" : "Se connecter"} <Heart size={15} /></button>
          </form>
          {showResend && email && <button className="auth-resend" type="button" onClick={() => void resendVerification()}>Renvoyer le lien de vérification</button>}
          <div className="auth-divider"><span>ou</span></div>
          <button className="auth-social-button" type="button" disabled={busy} onClick={() => void signInWithGoogle()}><span className="google-mark" aria-hidden="true">G</span> Continuer avec Google</button>
          <div className="login-switch">Pas encore de compte ? <Link className="text-link" href="/inscription">Créer votre espace</Link></div>
          <div className="install-note"><ShieldCheck size={16} /> Vos données sont isolées dans votre foyer. Seuls ses membres peuvent les consulter.</div>
        </div>
      </section>
    </main>
  );
}
