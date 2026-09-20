import type { CommandeShopify, NatureTransactionShopify, StatutTransactionShopify } from "../domain/types";
import type { OrderNode } from "./graphql";

const NATURES_CONNUES = new Set<string>(["SALE", "CAPTURE", "REFUND", "VOID", "AUTHORIZATION"]);

function mapperNature(kind: string): NatureTransactionShopify | null {
  const kindMinuscule = kind.toLowerCase();
  if (!NATURES_CONNUES.has(kind)) return null; // CHANGE, EMV_AUTHORIZATION, SUGGESTED_REFUND : hors périmètre V1
  return kindMinuscule as NatureTransactionShopify;
}

function mapperStatut(status: string): StatutTransactionShopify {
  return status.toLowerCase() as StatutTransactionShopify;
}

/** Convertit une commande GraphQL Shopify en `CommandeShopify` (type du moteur métier). */
export function mapperCommande(node: OrderNode): CommandeShopify {
  return {
    id: node.id,
    name: node.name,
    sourceName: node.sourceName ?? "web",
    // nomClient/clientId restent undefined : le champ `customer` n'est pas demandé
    // tant que l'accès aux protected customer data n'est pas approuvé (voir graphql.ts).
    estVenteDeCarteCadeau: node.lineItems.nodes.some((li) => li.isGiftCard),
    transactions: node.transactions
      .map((t) => {
        const kind = mapperNature(t.kind);
        if (!kind || !t.processedAt) return null;
        return {
          id: t.id,
          orderId: node.id,
          kind,
          status: mapperStatut(t.status),
          amount: Number.parseFloat(t.amountSet.shopMoney.amount),
          gateway: t.gateway,
          processedAt: t.processedAt,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null),
  };
}
