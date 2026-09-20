/**
 * Envoi d'emails via l'API HTTP de Resend (pas de SDK : une seule requête, pas de
 * dépendance supplémentaire à maintenir). Nécessite RESEND_API_KEY sur l'hébergeur ;
 * sans elle, on journalise et on n'envoie rien plutôt que de faire échouer l'appelant
 * (un rappel email manqué ne doit jamais bloquer le reste du cron).
 */
export async function envoyerEmail(params: {
  destinataire: string;
  sujet: string;
  texte: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY absente : email non envoyé.", { destinataire: params.destinataire });
    return;
  }

  const expediteur = process.env.RESEND_FROM_EMAIL || "Recettes URSSAF <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: expediteur,
      to: [params.destinataire],
      subject: params.sujet,
      text: params.texte,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const corps = await response.text();
    throw new Error(`Échec de l'envoi Resend (${response.status}) : ${corps}`);
  }
}
