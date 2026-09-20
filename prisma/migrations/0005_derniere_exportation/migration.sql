-- Date du dernier export CSV/PDF, pour un bandeau de rappel d'export qui ne
-- s'affiche que quand il est vraiment utile. Idempotent.

ALTER TABLE "Boutique" ADD COLUMN IF NOT EXISTS "derniereExportation" TIMESTAMP(3);
