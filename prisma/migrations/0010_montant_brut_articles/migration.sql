-- Ajoute le CA brut (avant remboursement) par article vendu, pour calculer un taux
-- de remboursement par produit sans jamais fausser "Meilleures ventes" (qui reste
-- basé uniquement sur le CA net). Idempotent.

ALTER TABLE "ArticleVendu" ADD COLUMN IF NOT EXISTS "montantBrut" DECIMAL(12,2) NOT NULL DEFAULT 0;
