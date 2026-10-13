-- Nouvelle table pour les statistiques de ventes par produit ("meilleures ventes",
-- app.statistiques.tsx) — informatif, jamais la source du CA déclaré à l'URSSAF.

CREATE TABLE IF NOT EXISTS "ArticleVendu" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "ligneCommandeId" TEXT NOT NULL,
    "dateVente" TIMESTAMP(3) NOT NULL,
    "titreProduit" TEXT NOT NULL,
    "titreVariante" TEXT,
    "quantite" INTEGER NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleVendu_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArticleVendu_ligneCommandeId_key" ON "ArticleVendu"("ligneCommandeId");

CREATE INDEX IF NOT EXISTS "ArticleVendu_shopDomain_dateVente_idx" ON "ArticleVendu"("shopDomain", "dateVente");

CREATE INDEX IF NOT EXISTS "ArticleVendu_shopDomain_titreProduit_idx" ON "ArticleVendu"("shopDomain", "titreProduit");

DO $$ BEGIN
  ALTER TABLE "ArticleVendu" ADD CONSTRAINT "ArticleVendu_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "Boutique"("shopDomain") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
