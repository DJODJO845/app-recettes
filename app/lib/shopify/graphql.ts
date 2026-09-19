/**
 * Requête GraphQL Admin API pour récupérer les commandes récentes avec tout ce dont
 * le moteur du livre des recettes a besoin (cf. app/lib/domain/livreDesRecettes.ts).
 *
 * `transactions` est un champ simple (pas une connection paginée) sur `Order` dans
 * l'API Admin GraphQL — à revalider dans le GraphiQL intégré (`shopify app dev`) une
 * fois une vraie session disponible, cette requête n'ayant pas pu être testée contre
 * un vrai schéma depuis cet environnement de développement.
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
        customer {
          id
          displayName
        }
        lineItems(first: 10) {
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
  customer: { id: string; displayName: string } | null;
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
