-- Adresse email optionnelle pour le rappel de fin de période, en remplacement de
-- l'email du compte Shopify (voir api.cron.rappels-echeance.tsx). Idempotent.

ALTER TABLE "Boutique" ADD COLUMN IF NOT EXISTS "emailRappel" TEXT;
