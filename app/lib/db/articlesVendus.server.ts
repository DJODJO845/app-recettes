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
      })),
      skipDuplicates: true,
    }),
  );

  return resultat.count;
}

export interface MeilleureVente {
  titreProduit: string;
  quantite: number;
  montant: number;
}

/**
 * Les produits les plus vendus sur une période, groupés par titre (pas par variante :
 * un éclatement par variante produirait souvent une liste de quasi-doublons peu
 * lisible pour un premier aperçu), classés par CA généré décroissant.
 */
export async function obtenirMeilleuresVentes(
  shopDomain: string,
  debut: Date,
  fin: Date,
  limite: number,
): Promise<MeilleureVente[]> {
  const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.articleVendu.groupBy({
      by: ["titreProduit"],
      where: { shopDomain, dateVente: { gte: debut, lte: fin } },
      _sum: { quantite: true, montant: true },
      orderBy: { _sum: { montant: "desc" } },
      take: limite,
    }),
  );

  return resultat.map((ligne) => ({
    titreProduit: ligne.titreProduit,
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
