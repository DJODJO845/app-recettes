import { construireLignesLivre } from "../domain/livreDesRecettes";
import { enregistrerLignes } from "../db/lignesLivre.server";
import { mapperCommande } from "./mapper.server";
import { REQUETE_COMMANDES_RECENTES, type CommandesRecentesResponse } from "./graphql";

interface ClientGraphQLAdmin {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

/**
 * Importe les commandes de la boutique depuis `depuis`, construit les lignes du
 * livre des recettes (règles CONFORMITÉ de la Phase 1) et les enregistre.
 * Idempotent : rejouable sans créer de doublons (transactionId unique).
 *
 * La profondeur d'historique réellement accessible dépend du scope Shopify accordé
 * (`read_orders` = 60 jours, `read_all_orders` = historique complet une fois
 * approuvé — cf. docs/phase-2-architecture.md) ; interroger au-delà ne provoque pas
 * d'erreur, Shopify renvoie simplement ce à quoi l'app a accès.
 */
export async function importerCommandesRecentes(
  admin: ClientGraphQLAdmin,
  shopDomain: string,
  depuis: Date,
): Promise<number> {
  const requete = `created_at:>='${depuis.toISOString()}'`;
  let cursor: string | null = null;
  let hasNextPage = true;
  let totalLignesEnregistrees = 0;

  while (hasNextPage) {
    const response = await admin.graphql(REQUETE_COMMANDES_RECENTES, {
      variables: { cursor, requete },
    });
    const json = (await response.json()) as CommandesRecentesResponse;

    const lignes = json.data.orders.nodes.flatMap((node) => construireLignesLivre(mapperCommande(node)));
    totalLignesEnregistrees += await enregistrerLignes(shopDomain, lignes);

    hasNextPage = json.data.orders.pageInfo.hasNextPage;
    cursor = json.data.orders.pageInfo.endCursor;
  }

  return totalLignesEnregistrees;
}
