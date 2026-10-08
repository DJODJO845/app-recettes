-- Niveau d'alerte de plafond déjà notifié par email, pour n'envoyer qu'au
-- franchissement d'un seuil (pas à chaque exécution du cron quotidien). Idempotent.

DO $$ BEGIN
  CREATE TYPE "NiveauAlerte" AS ENUM ('OK', 'AVERTISSEMENT', 'CRITIQUE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Boutique" ADD COLUMN IF NOT EXISTS "derniereAlertePlafondNiveau" "NiveauAlerte" NOT NULL DEFAULT 'OK';
