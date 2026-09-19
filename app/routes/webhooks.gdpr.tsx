import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { depotPrisma } from "../lib/webhooks/gdprPrisma.server";
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
 * Simplification V1 assumée : pour `customers/data_request`, l'app rassemble les
 * données et les journalise pour que le marchand les transmette lui-même au client
 * (aucun envoi automatique par e-mail — pas d'infrastructure SMTP en V1). C'est
 * conforme à Shopify (qui n'impose pas de canal de livraison particulier à l'app),
 * mais reste manuel côté marchand.
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
