import { construireLignesLivre } from "./livreDesRecettes";
import type { ArticleVenduDomaine, CommandeShopify } from "./types";

export interface ResultatArticlesCommande {
  /**
   * GID de toutes les lignes de produit de la commande, même si `articles` est vide —
   * sert à effacer d'anciennes lignes déjà enregistrées lors d'un import précédent, si
   * la commande est depuis (ré)remboursée (voir importerCommandes.server.ts).
   */
  idsLigneCommande: string[];
  articles: ArticleVenduDomaine[];
}

/**
 * Date d'attribution des articles vendus d'une commande : celle de sa première
 * transaction de vente réussie — même principe que le livre des recettes (un article
 * n'est compté "vendu" que si quelque chose a réellement été encaissé). Une commande
 * sans transaction de vente réussie (jamais payée, paiement en attente, commande
 * brouillon non réglée) n'a pas de date d'attribution : ses articles sont alors
 * exclus, pour ne pas fausser les statistiques avec des ventes jamais concrétisées.
 */
function dateDePremiereVenteReussie(commande: CommandeShopify): string | null {
  const dates = commande.transactions
    .filter((transaction) => transaction.status === "success" && (transaction.kind === "sale" || transaction.kind === "capture"))
    .map((transaction) => transaction.processedAt);

  if (dates.length === 0) return null;
  return dates.reduce((plusAncienne, date) => (date < plusAncienne ? date : plusAncienne));
}

/**
 * CA net réellement encaissé pour la commande, calculé via `construireLignesLivre`
 * (même fonction que le livre des recettes, pas une réimplémentation parallèle) : ne
 * garde que les lignes qui comptent dans le CA (`compteDansCA`), donc exclut déjà les
 * règlements par carte cadeau (l'argent est entré ailleurs) et soustrait tout
 * remboursement, partiel ou total. Une seule source de vérité pour "combien cette
 * commande a-t-elle vraiment rapporté" — évite que les Statistiques se désynchronisent
 * du livre si ses règles évoluent un jour.
 */
function netEncaisseLivre(commande: CommandeShopify): number {
  return construireLignesLivre(commande)
    .filter((ligne) => ligne.compteDansCA)
    .reduce((total, ligne) => total + ligne.montant, 0);
}

/**
 * Construit les lignes de statistiques produit d'une commande, à la date de son
 * premier encaissement réel. Deux montants par article, pour deux usages distincts :
 *  - `montant` : sa part proportionnelle du CA NET réellement encaissé pour la
 *    commande entière (frais de port et remises globales inclus, remboursements
 *    déduits — 0 si la commande est intégralement remboursée). Seul utilisé pour
 *    "Meilleures ventes", pour que ce classement ne compte jamais un produit revenu
 *    comme une vente, et que le total corresponde exactement au livre des recettes.
 *  - `montantBrut` : sa part du prix AVANT tout remboursement. Sert uniquement à
 *    calculer un taux de remboursement par produit (obtenirTauxRemboursement) — une
 *    commande remboursée n'est donc plus exclue ici comme avant, juste comptée à 0€
 *    net tout en gardant trace de ce qu'elle valait au départ.
 * La répartition par produit reste une approximation (on ne sait pas quel article
 * précis portait la remise ou le remboursement), mais les deux totaux, eux, sont
 * exacts.
 */
export function construireArticlesVendus(commande: CommandeShopify): ResultatArticlesCommande {
  const idsLigneCommande = commande.articles.map((article) => article.id);
  const date = dateDePremiereVenteReussie(commande);
  if (!date) return { idsLigneCommande, articles: [] };

  const montantArticlesBrut = commande.articles.reduce((somme, article) => somme + article.montant, 0);
  if (montantArticlesBrut <= 0) return { idsLigneCommande, articles: [] };

  // Jamais négatif : un remboursement ne devrait jamais dépasser la vente d'origine,
  // mais si c'était le cas (donnée Shopify incohérente), 0€ net reste le plancher
  // correct plutôt qu'un montant négatif absurde dans "Meilleures ventes".
  const net = Math.max(0, netEncaisseLivre(commande));
  const facteurRepartition = net / montantArticlesBrut;

  return {
    idsLigneCommande,
    articles: commande.articles.map((article) => ({
      id: article.id,
      date,
      titreProduit: article.titre,
      titreVariante: article.titreVariante,
      quantite: article.quantite,
      montant: article.montant * facteurRepartition,
      montantBrut: article.montant,
    })),
  };
}
