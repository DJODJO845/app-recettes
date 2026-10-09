-- Date du dernier import réussi des commandes Shopify, pour un import
-- incrémental plutôt qu'un rechargement complet à chaque visite. Idempotent.

ALTER TABLE "Boutique" ADD COLUMN IF NOT EXISTS "derniereImportation" TIMESTAMP(3);
