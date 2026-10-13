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
 * CA de vente et montant remboursé de la commande, calculés via `construireLignesLivre`
 * (même fonction que le livre des recettes, pas une réimplémentation parallèle) : ne
 * garde que les lignes qui comptent dans le CA (`compteDansCA`, donc les règlements
 * par carte cadeau déjà exclus), séparées en deux sommes plutôt qu'une seule
 * soustraction — une remise globale ou des frais de port (déjà inclus dans `vente`,
 * voir livreDesRecettes.ts) ne doivent JAMAIS ressortir comme un remboursement.
 * Confondre les deux a été un bug réel en prod le 13 octobre 2026 : une commande
 * remisée sans aucun remboursement affichait un faux "taux de remboursement".
 */
function venteEtRemboursement(commande: CommandeShopify): { vente: number; remboursement: number } {
  const lignes = construireLignesLivre(commande).filter((ligne) => ligne.compteDansCA);
  const vente = lignes.filter((ligne) => ligne.nature !== "remboursement").reduce((total, ligne) => total + ligne.montant, 0);
  // ligne.montant est déjà négatif pour un remboursement (voir livreDesRecettes.ts) : on l'inverse pour obtenir un montant positif.
  const remboursement = lignes.filter((ligne) => ligne.nature === "remboursement").reduce((total, ligne) => total - ligne.montant, 0);
  return { vente, remboursement };
}

/**
 * Construit les lignes de statistiques produit d'une commande, à la date de son
 * premier encaissement réel. Deux montants par article, pour deux usages distincts :
 *  - `montant` : sa part proportionnelle du CA NET réellement encaissé pour la
 *    commande entière (frais de port et remises globales inclus, remboursements
 *    déduits — 0 si la commande est intégralement remboursée). Seul utilisé pour
 *    "Meilleures ventes", pour que ce classement ne compte jamais un produit revenu
 *    comme une vente, et que le total corresponde exactement au livre des recettes.
 *  - `montantBrut` : sa part de la vente AVANT remboursement (mais déjà APRÈS remise
 *    et frais de port — ceux-là ne sont pas un remboursement). Sert uniquement à
 *    calculer un taux de remboursement par produit (obtenirTauxRemboursement) : une
 *    commande remboursée n'est donc plus exclue ici comme avant, juste comptée à 0€
 *    net tout en gardant trace de ce qu'elle valait avant le remboursement.
 * La répartition par produit reste une approximation (on ne sait pas quel article
 * précis portait la remise ou le remboursement), mais les totaux, eux, sont exacts.
 */
export function construireArticlesVendus(commande: CommandeShopify): ResultatArticlesCommande {
  const idsLigneCommande = commande.articles.map((article) => article.id);
  const date = dateDePremiereVenteReussie(commande);
  if (!date) return { idsLigneCommande, articles: [] };

  // Poids de répartition entre articles (pas un montant encaissé en soi) : le prix
  // affiché de chaque article détermine sa part relative de la commande.
  const poidsTotal = commande.articles.reduce((somme, article) => somme + article.montant, 0);
  if (poidsTotal <= 0) return { idsLigneCommande, articles: [] };

  const { vente, remboursement } = venteEtRemboursement(commande);
  // Jamais négatif : un remboursement ne devrait jamais dépasser la vente d'origine,
  // mais si c'était le cas (donnée Shopify incohérente), 0€ reste le plancher correct
  // plutôt qu'un montant négatif absurde.
  const venteNette = Math.max(0, vente);
  const remboursementNet = Math.max(0, remboursement);
  const net = Math.max(0, venteNette - remboursementNet);

  return {
    idsLigneCommande,
    articles: commande.articles.map((article) => {
      const poids = article.montant / poidsTotal;
      return {
        id: article.id,
        date,
        titreProduit: article.titre,
        titreVariante: article.titreVariante,
        quantite: article.quantite,
        montant: net * poids,
        montantBrut: venteNette * poids,
      };
    }),
  };
}
