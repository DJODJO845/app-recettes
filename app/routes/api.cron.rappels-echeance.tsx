import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { calculerCAPeriode } from "../lib/domain/livreDesRecettes";
import { periodeVientDeSeTerminer } from "../lib/domain/periode";
import { listerLignes } from "../lib/db/lignesLivre.server";
import { envoyerEmail } from "../lib/email/resend.server";

const formateurEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Appelée une fois par jour par un déclencheur externe (workflow GitHub Actions —
 * pas de cron intégré à ce service web). Protégée par un secret partagé plutôt que
 * par l'auth Shopify, car l'appelant n'est pas une boutique mais un job planifié.
 * Un échec sur une boutique (token révoqué, email absent…) ne doit jamais empêcher
 * de traiter les autres, d'où le try/catch par boutique.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const boutiques = await prisma.boutique.findMany();
  const maintenant = new Date();
  let envoyes = 0;
  const erreurs: string[] = [];

  for (const boutique of boutiques) {
    const { estDue, periode } = periodeVientDeSeTerminer(boutique.periodicite, maintenant);
    if (!estDue) continue;

    try {
      // L'email choisi dans Réglages (app.reglages.tsx) prime sur celui du compte
      // Shopify, pour permettre d'envoyer le rappel à un comptable ou une autre boîte.
      let email = boutique.emailRappel;
      if (!email) {
        const { admin } = await unauthenticated.admin(boutique.shopDomain);
        const reponse = await admin.graphql(`#graphql
          query { shop { email } }
        `);
        const json = (await reponse.json()) as { data?: { shop?: { email?: string | null } } };
        email = json.data?.shop?.email ?? null;
      }
      if (!email) continue;

      const lignes = await listerLignes(boutique.shopDomain, { debut: periode.debut, fin: periode.fin });
      const ca = calculerCAPeriode(lignes, periode.debut, periode.fin);
      const montant = formateurEUR.format(ca);

      await envoyerEmail({
        destinataire: email,
        sujet: `Votre CA à déclarer à l'URSSAF : ${montant}`,
        texte:
          `Votre période de déclaration (${periode.label}) est terminée.\n\n` +
          `CA encaissé à déclarer : ${montant}\n\n` +
          `Retrouvez le détail dans le livre des recettes de l'app Recettes URSSAF.`,
        html:
          `<p>Votre période de déclaration (<strong>${periode.label}</strong>) est terminée.</p>` +
          `<p>CA encaissé à déclarer : <strong>${montant}</strong></p>` +
          `<p>Retrouvez le détail dans le livre des recettes de l'app Recettes URSSAF.</p>`,
      });
      envoyes++;
    } catch (erreur) {
      console.error(`Échec du rappel d'échéance pour ${boutique.shopDomain} :`, erreur);
      erreurs.push(boutique.shopDomain);
    }
  }

  return { envoyes, erreurs };
};
