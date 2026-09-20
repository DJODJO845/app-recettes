/**
 * Requête GraphQL Admin API pour récupérer les commandes récentes avec tout ce dont
 * le moteur du livre des recettes a besoin (cf. app/lib/domain/livreDesRecettes.ts).
 *
 * Le champ `customer` est volontairement absent : Shopify rejette toute la requête
 * (erreur "This app is not approved to access the Order object") tant que l'accès aux
 * protected customer data n'a pas été approuvé (cf. docs/phase-2-architecture.md —
 * demande à soumettre dans le Partner Dashboard, comme `read_all_orders`). En
 * attendant, le nom du client reste "Client" générique (cf. Phase 1 CONFORMITÉ).
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
