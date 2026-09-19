import type { LigneLivreDesRecettes } from "../domain/types";

/**
 * Abstraction du stockage, pour pouvoir tester la logique des webhooks RGPD sans base
 * de données réelle. L'implémentation concrète (Prisma + Supabase) sera branchée une
 * fois les credentials disponibles (cf. docs/phase-3-developpement.md).
 */
export interface DepotLignesLivre {
  /**
   * Identifie le client par son `clientId` Shopify (GID), pas par son nom affiché :
   * deux clients peuvent porter le même nom, ce n'est pas un identifiant fiable pour
   * une obligation RGPD.
   */
  listerParClientId(shopDomain: string, clientId: string): Promise<LigneLivreDesRecettes[]>;
  /** Remplace le nom du client par "Client" sur toutes ses lignes ; ne supprime jamais la ligne. */
  anonymiserClientId(shopDomain: string, clientId: string): Promise<number>;
  /** Supprime toutes les lignes d'une boutique (reçu 48h après désinstallation). */
  supprimerToutesLesLignes(shopDomain: string): Promise<number>;
}

/**
 * Webhook `customers/data_request` : un client demande à voir les données que l'app
 * détient sur lui. On renvoie les lignes du livre où il apparaît.
 */
export async function traiterDemandeDonneesClient(
  depot: DepotLignesLivre,
  shopDomain: string,
  clientId: string,
): Promise<LigneLivreDesRecettes[]> {
  return depot.listerParClientId(shopDomain, clientId);
}

/**
 * Webhook `customers/redact` : un client demande la suppression de ses données
 * personnelles. On anonymise le nom sur les lignes (obligation RGPD) SANS supprimer les
 * lignes elles-mêmes (obligation légale française de conservation du livre des recettes
 * pendant 10 ans, cf. section 3 du cahier des charges — ces deux obligations coexistent
 * en gardant le montant/la date/la référence mais en retirant l'identifiant nominatif).
 */
export async function traiterEffacementClient(
  depot: DepotLignesLivre,
  shopDomain: string,
  clientId: string,
): Promise<number> {
  return depot.anonymiserClientId(shopDomain, clientId);
}

/**
 * Webhook `shop/redact` : reçu 48h après la désinstallation de l'app. Toutes les
 * données de la boutique sont supprimées — c'est pour cela que l'app doit avoir
 * répété les rappels d'export au marchand pendant qu'elle était installée
 * (cf. docs/phase-2-architecture.md, plan des écrans, point 5).
 */
export async function traiterEffacementBoutique(
  depot: DepotLignesLivre,
  shopDomain: string,
): Promise<number> {
  return depot.supprimerToutesLesLignes(shopDomain);
}
