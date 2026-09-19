-- Complète la table Session avec les colonnes attendues par
-- @shopify/shopify-app-session-storage-prisma (utilisateur en ligne : prénom, nom,
-- e-mail, jeton de rafraîchissement...). Idempotent (IF NOT EXISTS) pour pouvoir être
-- rejoué sans erreur si une partie a déjà été appliquée.

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "accountOwner" BOOLEAN DEFAULT false;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "locale" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "collaborator" BOOLEAN DEFAULT false;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT false;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "refreshTokenExpires" TIMESTAMP(3);
