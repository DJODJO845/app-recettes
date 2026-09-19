-- Ajoute l'identifiant Shopify du client sur chaque ligne, pour un traitement fiable
-- des webhooks RGPD (le nom affiché seul n'est pas un identifiant sûr). Idempotent.

ALTER TABLE "LigneLivre" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
CREATE INDEX IF NOT EXISTS "LigneLivre_shopDomain_clientId_idx" ON "LigneLivre"("shopDomain", "clientId");
