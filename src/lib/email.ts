type AuthEmail = {
  to: string;
  subject: string;
  text: string;
};

export async function sendAuthEmail(email: AuthEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY et EMAIL_FROM doivent être configurés pour envoyer les e-mails d’authentification.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text }),
  });
  if (!response.ok) throw new Error(`L’envoi de l’e-mail d’authentification a échoué (HTTP ${response.status}).`);
}
