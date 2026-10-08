import { unauthenticated } from "../../shopify.server";

/**
 * Email à utiliser pour les envois automatiques (rappels d'échéance, alertes de
 * plafond...) : celui choisi dans Réglages prime sur celui du compte Shopify, pour
 * permettre d'envoyer ces notifications à un comptable ou une autre boîte.
 */
export async function resoudreEmailBoutique(
  shopDomain: string,
  emailRappel: string | null,
): Promise<string | null> {
  if (emailRappel) return emailRappel;

  const { admin } = await unauthenticated.admin(shopDomain);
  const reponse = await admin.graphql(`#graphql
    query { shop { email } }
  `);
  const json = (await reponse.json()) as { data?: { shop?: { email?: string | null } } };
  return json.data?.shop?.email ?? null;
}
