import type { ArticleVenduDomaine } from "../domain/types";
import { executerAvecContexteBoutique } from "./rls.server";

/**
 * Supprime les lignes déjà enregistrées pour ces lignes de commande, avant de les
 * réinsérer (voir importerCommandes.server.ts) — rend l'import auto-réparateur : si
 * une commande déjà importée est depuis remboursée, le prochain import efface
 * l'ancienne ligne au lieu de la laisser périmée (contrairement au livre des
 * recettes, où chaque ligne reste immuable par obligation légale — voir
 * lignesLivre.server.ts).
 */
export async function supprimerArticlesVendus(shopDomain: string, idsLigneCommande: string[]): Promise<void> {
  if (idsLigneCommande.length === 0) return;

  await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.articleVendu.deleteMany({
      where: { shopDomain, ligneCommandeId: { in: idsLigneCommande } },
    }),
  );
}

/**
 * Enregistre les articles vendus construits par `construireArticlesVendus` (import
 * Shopify), en ignorant ceux déjà présents (idempotence via `ligneCommandeId` unique).
 */
export async function enregistrerArticlesVendus(
  shopDomain: string,
  articles: ArticleVenduDomaine[],
): Promise<number> {
  if (articles.length === 0) return 0;

  const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.articleVendu.createMany({
      data: articles.map((article) => ({
        shopDomain,
        ligneCommandeId: article.id,
        dateVente: new Date(article.date),
        titreProduit: article.titreProduit,
        titreVariante: article.titreVariante,
        quantite: article.quantite,
        montant: article.montant,
        montantBrut: article.montantBrut,
      })),
      skipDuplicates: true,
    }),
  );

  return resultat.count;
}

export interface MeilleureVente {
  titreProduit: string;
  titreVariante: string | null;
  quantite: number;
  montant: number;
}

/**
 * Les produits les plus vendus sur une période, groupés par titre ET variante (ex.
 * taille, couleur) : un marchand veut voir quelle déclinaison précise se vend, pas
 * juste le produit générique (voir discussion du 13 octobre 2026). Classés par CA
 * généré décroissant. `montant: { gt: 0 }` exclut les lignes intégralement
 * remboursées (CA net nul) : un produit revenu n'est pas une vente pour ce
 * classement, voir construireArticlesVendus — mais la ligne reste en base pour
 * obtenirTauxRemboursement.
 */
export async function obtenirMeilleuresVentes(
  shopDomain: string,
  debut: Date,
  fin: Date,
  limite: number,
): Promise<MeilleureVente[]> {
  const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.articleVendu.groupBy({
      by: ["titreProduit", "titreVariante"],
      where: { shopDomain, dateVente: { gte: debut, lte: fin }, montant: { gt: 0 } },
      _sum: { quantite: true, montant: true },
      orderBy: { _sum: { montant: "desc" } },
      take: limite,
    }),
  );

  return resultat.map((ligne) => ({
    titreProduit: ligne.titreProduit,
    titreVariante: ligne.titreVariante,
    quantite: ligne._sum.quantite ?? 0,
    montant: Number(ligne._sum.montant ?? 0),
  }));
}

/**
 * CA total généré sur la période, tous produits confondus — sert de dénominateur
 * pour calculer les pourcentages (camembert des meilleures ventes), y compris la
 * part "Autres" au-delà du top affiché.
 */
export async function obtenirTotalVentes(shopDomain: string, debut: Date, fin: Date): Promise<number> {
  const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.articleVendu.aggregate({
      where: { shopDomain, dateVente: { gte: debut, lte: fin } },
      _sum: { montant: true },
    }),
  );

  return Number(resultat._sum.montant ?? 0);
}

export interface ProduitRembourse {
  titreProduit: string;
  titreVariante: string | null;
  montantRembourse: number;
}

/**
 * Produits avec le plus d'argent remboursé sur une période, classés par montant —
 * vue séparée des "Meilleures ventes" (CA net), volontairement : un produit souvent
 * remboursé peut signaler un souci (qualité, taille, description trompeuse), une info
 * que la seule liste des meilleures ventes masquerait complètement puisqu'il en est
 * exclu. Pas de taux par produit ici (un produit remboursé à 100% pour 10€ pèserait
 * plus haut qu'un produit remboursé à 5% pour 500€, alors que c'est l'inverse en
 * impact réel) — le pourcentage affiché (camembert, voir app.statistiques.tsx) est
 * la part de CE produit dans le TOTAL remboursé de la période, pas son propre taux.
 */
export async function obtenirProduitsRembourses(
  shopDomain: string,
  debut: Date,
  fin: Date,
  limite: number,
): Promise<ProduitRembourse[]> {
  const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.articleVendu.groupBy({
      by: ["titreProduit", "titreVariante"],
      where: { shopDomain, dateVente: { gte: debut, lte: fin }, montantBrut: { gt: 0 } },
      _sum: { montant: true, montantBrut: true },
    }),
  );

  return resultat
    .map((ligne) => {
      const montantBrut = Number(ligne._sum.montantBrut ?? 0);
      const montantNet = Number(ligne._sum.montant ?? 0);
      return {
        titreProduit: ligne.titreProduit,
        titreVariante: ligne.titreVariante,
        montantRembourse: Math.max(0, montantBrut - montantNet),
      };
    })
    .filter((ligne) => ligne.montantRembourse > 0.005)
    .sort((a, b) => b.montantRembourse - a.montantRembourse)
    .slice(0, limite);
}

/**
 * Montant total remboursé sur la période, tous produits confondus — dénominateur du
 * camembert des remboursements (y compris la part "Autres" au-delà du top affiché),
 * même principe que obtenirTotalVentes.
 */
export async function obtenirTotalRembourse(shopDomain: string, debut: Date, fin: Date): Promise<number> {
  const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.articleVendu.aggregate({
      where: { shopDomain, dateVente: { gte: debut, lte: fin } },
      _sum: { montant: true, montantBrut: true },
    }),
  );

  const montantBrut = Number(resultat._sum.montantBrut ?? 0);
  const montantNet = Number(resultat._sum.montant ?? 0);
  return Math.max(0, montantBrut - montantNet);
}
