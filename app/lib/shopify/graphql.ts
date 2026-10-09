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
        # ATTENTION coût de requête : lineItems est imbriqué DANS orders(first: 25), donc
        # le coût calculé par l'API Admin de Shopify (basé sur les arguments "first" des
        # connexions, PAS sur le nombre réel de résultats — donc même une boutique avec
        # peu de commandes est concernée) multiplie ces deux valeurs. Une valeur déjà
        # tentée ici (250) donnait 25 × 250 ≈ 6250 points rien que pour ce champ, largement
        # au-delà du seau de la limitation de débit de Shopify (1000-2000 points) : la
        # requête entière aurait été rejetée (coût maximum dépassé) à CHAQUE import, sur
        # TOUTE boutique — un échec bien plus grave que le problème cosmétique que 250
        # visait à corriger. 10 reste un compromis raisonnable : une commande à plus de 10
        # articles dont la carte cadeau serait le 11e ou au-delà serait mal étiquetée
        # "vente" au lieu de "vente de carte cadeau" (n'affecte que le libellé affiché, pas
        # le CA compté — les deux comptent dans le CA encaissé), un risque bien moindre
        # qu'une requête d'import systématiquement rejetée.
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

/**
 * Les montants importés (amountSet.shopMoney) sont dans la devise de la boutique,
 * pas forcément en euros. L'app affiche partout un symbole "€" sans jamais vérifier
 * cette hypothèse : sur une boutique configurée dans une autre devise, les montants
 * seraient silencieusement affichés avec le mauvais symbole — trompeur pour une
 * déclaration URSSAF, qui exige des montants en euros. Voir app._index.tsx.
 */
export const REQUETE_DEVISE_BOUTIQUE = `#graphql
  query DeviseBoutique {
    shop {
      currencyCode
    }
  }
`;

export interface DeviseBoutiqueResponse {
  data: { shop: { currencyCode: string } };
}
