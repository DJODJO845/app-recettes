-- Met en cache le résultat de la vérification de devise de la boutique (sinon
-- refaite à chaque chargement du Dashboard, un appel Shopify quasi toujours
-- inutile puisque la devise d'une boutique change très rarement). Idempotent.

ALTER TABLE "Boutique" ADD COLUMN IF NOT EXISTS "deviseBoutique" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Boutique" ADD COLUMN IF NOT EXISTS "derniereVerificationDevise" TIMESTAMP(3);
