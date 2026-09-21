import { commandeEstDansPerimetre, construireLignesLivre } from "../domain/livreDesRecettes";
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
 * `plancherPeriode` reste un filtre de sécurité appliqué APRÈS coup (pas dans la
 * requête Shopify) : comme `updated_at` peut ramener une commande créée bien avant le
 * début d'activité déclaré du marchand (ex. une commande de test très ancienne
 * retouchée par erreur, ou une commande passée avant l'inscription officielle puis
 * remboursée après), on écarte toute commande dont la vente d'origine précède cette
 * borne — voir commandeEstDansPerimetre, qui écarte la commande ENTIÈRE (vente et
 * remboursement) plutôt que ligne par ligne : filtrer ligne par ligne laisserait
 * passer le remboursement d'une vente elle-même hors périmètre, créant une ligne
 * négative sans vente correspondante dans le livre et faisant baisser à tort le CA
 * déclaré, alors que cette vente n'y a jamais été comptée pour commencer.
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

    // Filtre par commande ENTIÈRE d'abord (vente d'origine avant le plancher = toute
    // la commande hors périmètre, remboursement compris — voir commandeEstDansPerimetre),
    // puis par ligne en filet de sécurité final pour le cas résiduel d'une commande
    // sans aucune transaction de vente.
    const lignes = json.data.orders.nodes
      .map(mapperCommande)
      .filter((commande) => commandeEstDansPerimetre(commande, plancherPeriode))
      .flatMap(construireLignesLivre)
      .filter((ligne) => new Date(ligne.date) >= plancherPeriode);
    totalLignesEnregistrees += await enregistrerLignes(shopDomain, lignes);

    hasNextPage = json.data.orders.pageInfo.hasNextPage;
    cursor = json.data.orders.pageInfo.endCursor;
  }

  return totalLignesEnregistrees;
}
