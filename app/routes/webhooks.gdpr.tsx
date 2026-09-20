import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import { envoyerEmail } from "../lib/email/resend.server";
import { depotPrisma } from "../lib/webhooks/gdprPrisma.server";
import type { LigneLivreDesRecettes } from "../lib/domain/types";
import { formateurEUR, formateurDate } from "../lib/ui/formateurs";
import {
  traiterDemandeDonneesClient,
  traiterEffacementBoutique,
  traiterEffacementClient,
} from "../lib/webhooks/gdpr";

interface PayloadClient {
  customer?: { id?: number };
}

/**
 * Les 3 webhooks RGPD obligatoires (compliance_topics dans shopify.app.toml) arrivent
 * tous sur cette route. Décisions CONFORMITÉ : cf. docs/phase-2-architecture.md.
 *
 * Pour `customers/data_request`, l'app rassemble les données du client et prévient le
 * marchand par email (voir notifierMarchandDemandeDonnees) : c'est lui qui doit les
 * transmettre au client dans le délai légal RGPD (1 mois), et un simple log serveur
 * qu'il ne consulte jamais reviendrait à le laisser rater cette obligation sans même
 * le savoir.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  console.log(`Reçu webhook RGPD ${topic} pour ${shop}`);

  const clientId = toGidClient((payload as PayloadClient).customer?.id);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      if (!clientId) break;
      const lignes = await traiterDemandeDonneesClient(depotPrisma, shop, clientId);
      console.log(
        `customers/data_request pour ${clientId} : ${lignes.length} ligne(s) à transmettre manuellement par le marchand.`,
      );
      try {
        await notifierMarchandDemandeDonnees(shop, clientId, lignes);
      } catch (erreur) {
        // Une notification manquée ne doit pas faire échouer le webhook (Shopify le
        // rejouerait indéfiniment) : le traitement RGPD lui-même a déjà réussi ci-dessus.
        console.error(`Échec de la notification email pour customers/data_request (${shop}) :`, erreur);
      }
      break;
    }
    case "CUSTOMERS_REDACT": {
      if (!clientId) break;
      const compte = await traiterEffacementClient(depotPrisma, shop, clientId);
      console.log(`customers/redact pour ${clientId} : ${compte} ligne(s) anonymisée(s).`);
      break;
    }
    case "SHOP_REDACT": {
      const compte = await traiterEffacementBoutique(depotPrisma, shop);
      console.log(`shop/redact pour ${shop} : ${compte} ligne(s) supprimée(s).`);
      break;
    }
  }

  return new Response();
};

function toGidClient(id: number | undefined): string | undefined {
  return id ? `gid://shopify/Customer/${id}` : undefined;
}

/**
 * Prévient le marchand par email qu'un client a fait une demande RGPD, avec les
 * lignes concernées à lui transmettre. Même logique de choix d'email (emailRappel
 * en priorité, sinon shop.email) que api.cron.rappels-echeance.tsx.
 */
async function notifierMarchandDemandeDonnees(
  shopDomain: string,
  clientId: string,
  lignes: LigneLivreDesRecettes[],
): Promise<void> {
  const boutique = await obtenirOuCreerBoutique(shopDomain);
  let email = boutique.emailRappel;
  if (!email) {
    const { admin } = await unauthenticated.admin(shopDomain);
    const reponse = await admin.graphql(`#graphql
      query { shop { email } }
    `);
    const json = (await reponse.json()) as { data?: { shop?: { email?: string | null } } };
    email = json.data?.shop?.email ?? null;
  }
  if (!email) return;

  const recap =
    lignes.length === 0
      ? "Aucune ligne du livre des recettes n'est associée à ce client."
      : lignes
          .map(
            (ligne) =>
              `- ${formateurDate.format(new Date(ligne.date))} · ${ligne.reference} · ${formateurEUR.format(ligne.montant)}`,
          )
          .join("\n");

  await envoyerEmail({
    destinataire: email,
    sujet: "Demande RGPD reçue : un client demande ses données",
    texte:
      `Un client (identifiant Shopify ${clientId}) a demandé, via Shopify, l'accès aux ` +
      `données que votre app « Recettes URSSAF » détient sur lui.\n\n` +
      `Vous devez lui transmettre ces informations dans le délai légal d'un mois (RGPD).\n\n` +
      `Lignes du livre des recettes concernées :\n${recap}`,
    html:
      `<p>Un client (identifiant Shopify <code>${clientId}</code>) a demandé, via Shopify, ` +
      `l'accès aux données que votre app « Recettes URSSAF » détient sur lui.</p>` +
      `<p>Vous devez lui transmettre ces informations dans le délai légal d'un mois (RGPD).</p>` +
      `<p>Lignes du livre des recettes concernées :</p><pre>${recap}</pre>`,
  });
}
