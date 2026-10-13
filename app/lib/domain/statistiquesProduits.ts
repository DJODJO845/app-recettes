import type { ArticleVenduDomaine, CommandeShopify } from "./types";

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
 * Construit les lignes de statistiques produit d'une commande (meilleures ventes),
 * à la date de son premier encaissement réel. Ces statistiques sont informatives —
 * elles aident le marchand à voir ce qui se vend — et ne sont jamais la source du CA
 * déclaré à l'URSSAF, qui reste calculé uniquement à partir du livre des recettes
 * (voir livreDesRecettes.ts) : un remboursement partiel ou un rabais après-coup n'a
 * par exemple aucun effet ici, contrairement au livre.
 */
export function construireArticlesVendus(commande: CommandeShopify): ArticleVenduDomaine[] {
  const date = dateDePremiereVenteReussie(commande);
  if (!date) return [];

  return commande.articles.map((article) => ({
    id: article.id,
    date,
    titreProduit: article.titre,
    titreVariante: article.titreVariante,
    quantite: article.quantite,
    montant: article.montant,
  }));
}
