import { construireLignesLivre } from "../domain/livreDesRecettes";
import { enregistrerLignes } from "../db/lignesLivre.server";
import { mapperCommande } from "./mapper.server";
import { REQUETE_COMMANDES_RECENTES, type CommandesRecentesResponse } from "./graphql";

interface ClientGraphQLAdmin {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

/**
 * Importe les commandes de la boutique modifiées depuis `depuisMiseAJour`, construit
 * les lignes du livre des recettes (règles CONFORMITÉ de la Phase 1) et les
 * enregistre. Idempotent : rejouable sans créer de doublons (transactionId unique).
 *
 * Filtre sur `updated_at`, pas `created_at` (voir le commentaire dans graphql.ts) :
 * ça permet de rattraper une commande ancienne dont le paiement (notamment manuel)
 * vient d'être confirmé, même si elle a été créée bien avant `depuisMiseAJour`.
 *
 * `planchePeriode` reste un filtre de sécurité appliqué APRÈS coup sur les lignes
 * construites (pas dans la requête Shopify) : comme `updated_at` peut ramener une
 * commande créée bien avant le début d'activité déclaré du marchand (ex. une
 * commande de test très ancienne retouchée par erreur), on ignore toute ligne dont
 * la date d'encaissement précède cette borne, pour ne jamais faire apparaître de CA
 * antérieur à ce que le marchand a lui-même déclaré comme point de départ.
 *
 * La profondeur d'historique réellement accessible dépend du scope Shopify accordé
 * (`read_orders` = 60 jours, `read_all_orders` = historique complet une fois
 * approuvé — cf. docs/phase-2-architecture.md) ; interroger au-delà ne provoque pas
 * d'erreur, Shopify renvoie simplement ce à quoi l'app a accès.
 */
export async function importerCommandesRecentes(
  admin: ClientGraphQLAdmin,
  shopDomain: string,
  depuisMiseAJour: Date,
  plancherPeriode: Date,
): Promise<number> {
  const requete = `updated_at:>='${depuisMiseAJour.toISOString()}'`;
  let cursor: string | null = null;
  let hasNextPage = true;
  let totalLignesEnregistrees = 0;

  while (hasNextPage) {
    const response = await admin.graphql(REQUETE_COMMANDES_RECENTES, {
      variables: { cursor, requete },
    });
    const json = (await response.json()) as CommandesRecentesResponse;

    const lignes = json.data.orders.nodes
      .flatMap((node) => construireLignesLivre(mapperCommande(node)))
      .filter((ligne) => new Date(ligne.date) >= plancherPeriode);
    totalLignesEnregistrees += await enregistrerLignes(shopDomain, lignes);

    hasNextPage = json.data.orders.pageInfo.hasNextPage;
    cursor = json.data.orders.pageInfo.endCursor;
  }

  return totalLignesEnregistrees;
}
