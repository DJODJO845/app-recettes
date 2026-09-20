/**
 * Requête GraphQL Admin API pour récupérer les commandes récentes avec tout ce dont
 * le moteur du livre des recettes a besoin (cf. app/lib/domain/livreDesRecettes.ts).
 *
 * Le champ `customer` est volontairement absent : Shopify rejette toute la requête
 * (erreur "This app is not approved to access the Order object") tant que l'accès aux
 * protected customer data n'a pas été approuvé (cf. docs/phase-2-architecture.md —
 * demande à soumettre dans le Partner Dashboard, comme `read_all_orders`). En
 * attendant, le nom du client reste "Client" générique (cf. Phase 1 CONFORMITÉ).
 *
 * Le filtre passé en `$requete` doit porter sur `updated_at`, pas `created_at` : une
 * commande peut être créée bien avant d'être réellement encaissée (paiement manuel
 * confirmé des jours/semaines plus tard, remboursement traité en différé...). Avec un
 * filtre sur `created_at`, un import incrémental (voir importerCommandes.server.ts)
 * ne re-demande que les commandes créées récemment — une commande ancienne dont le
 * paiement manuel vient tout juste d'être confirmé ne serait alors jamais rapatriée,
 * et son encaissement resterait silencieusement absent du livre des recettes.
 */
export const REQUETE_COMMANDES_RECENTES = `#graphql
  query CommandesRecentes($cursor: String, $requete: String) {
    orders(first: 25, after: $cursor, sortKey: CREATED_AT, query: $requete) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        sourceName
        # 250 (le maximum autorisé par Shopify pour ce type de champ) plutôt qu'une
        # petite valeur arbitraire : avec 10 par exemple, une commande à plus de 10
        # articles dont la carte cadeau serait le 11e ou au-delà aurait été mal
        # étiquetée "vente" au lieu de "vente de carte cadeau" (n'affecte que le
        # libellé affiché, pas le CA compté — les deux comptent dans le CA encaissé).
        lineItems(first: 250) {
          nodes {
            isGiftCard
          }
        }
        transactions {
          id
          kind
          status
          gateway
          processedAt
          amountSet {
            shopMoney {
              amount
            }
          }
        }
      }
    }
  }
`;

export interface OrderTransactionNode {
  id: string;
  kind: string;
  status: string;
  gateway: string;
  processedAt: string | null;
  amountSet: { shopMoney: { amount: string } };
}

export interface OrderNode {
  id: string;
  name: string;
  sourceName: string | null;
  lineItems: { nodes: { isGiftCard: boolean }[] };
  transactions: OrderTransactionNode[];
}

export interface CommandesRecentesResponse {
  data: {
    orders: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: OrderNode[];
    };
  };
}
