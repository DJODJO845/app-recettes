import type { ArticleVenduDomaine, CommandeShopify } from "./types";

export interface ResultatArticlesCommande {
  /**
   * GID de toutes les lignes de produit de la commande, même si `articles` est vide —
   * sert à effacer d'anciennes lignes déjà enregistrées lors d'un import précédent, si
   * la commande est depuis entièrement remboursée (voir importerCommandes.server.ts).
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
 * Montant net réellement encaissé pour la commande (ventes réussies moins
 * remboursements réussis) — même principe que `compteDansCA` du livre des recettes.
 * Sert à exclure des statistiques les commandes intégralement remboursées : sans ça,
 * un article resterait affiché comme "vendu" après un remboursement complet, alors
 * que le livre des recettes (seule source officielle du CA déclaré) retombe à 0€ net
 * pour cette commande.
 *
 * Limite assumée : un remboursement PARTIEL (ex. un seul article sur trois) n'est pas
 * réparti ligne par ligne — Shopify ne nous donne pas cette répartition dans les
 * données déjà récupérées (lineItems, pas refundLineItems) — l'exclusion ne
 * s'applique donc que si le remboursement ramène le total de la commande à 0€ ou
 * moins.
 */
function netVenteReussie(commande: CommandeShopify): number {
  return commande.transactions
    .filter((transaction) => transaction.status === "success" && (transaction.kind === "sale" || transaction.kind === "capture" || transaction.kind === "refund"))
    .reduce((total, transaction) => total + (transaction.kind === "refund" ? -transaction.amount : transaction.amount), 0);
}

/**
 * Construit les lignes de statistiques produit d'une commande (meilleures ventes),
 * à la date de son premier encaissement réel. Ces statistiques sont informatives —
 * elles aident le marchand à voir ce qui se vend — et ne sont jamais la source du CA
 * déclaré à l'URSSAF, qui reste calculé uniquement à partir du livre des recettes
 * (voir livreDesRecettes.ts) : une remise après-coup ou des frais de port n'ont par
 * exemple aucun effet ici, contrairement au livre.
 */
export function construireArticlesVendus(commande: CommandeShopify): ResultatArticlesCommande {
  const idsLigneCommande = commande.articles.map((article) => article.id);
  const date = dateDePremiereVenteReussie(commande);

  if (!date || netVenteReussie(commande) <= 0) {
    return { idsLigneCommande, articles: [] };
  }

  return {
    idsLigneCommande,
    articles: commande.articles.map((article) => ({
      id: article.id,
      date,
      titreProduit: article.titre,
      titreVariante: article.titreVariante,
      quantite: article.quantite,
      montant: article.montant,
    })),
  };
}
