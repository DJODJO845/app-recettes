-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Periodicite" AS ENUM ('MENSUELLE', 'TRIMESTRIELLE');

-- CreateEnum
CREATE TYPE "TypeActivite" AS ENUM ('COMMERCE', 'SERVICES', 'MIXTE');

-- CreateEnum
CREATE TYPE "NatureLigne" AS ENUM ('VENTE', 'VENTE_CARTE_CADEAU', 'REGLEMENT_CARTE_CADEAU', 'REMBOURSEMENT');

-- CreateTable
CREATE TABLE "Boutique" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "typeActivite" "TypeActivite" NOT NULL DEFAULT 'COMMERCE',
    "periodicite" "Periodicite" NOT NULL DEFAULT 'TRIMESTRIELLE',
    "dateDebutActivite" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneLivre" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "dateEncaissement" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "nature" "NatureLigne" NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "modeReglement" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "compteDansCA" BOOLEAN NOT NULL,
    "avertissement" TEXT,
    "corrigeLigneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LigneLivre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Boutique_shopDomain_key" ON "Boutique"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "LigneLivre_transactionId_key" ON "LigneLivre"("transactionId");

-- CreateIndex
CREATE INDEX "LigneLivre_shopDomain_dateEncaissement_idx" ON "LigneLivre"("shopDomain", "dateEncaissement");

-- AddForeignKey
ALTER TABLE "LigneLivre" ADD CONSTRAINT "LigneLivre_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "Boutique"("shopDomain") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Politiques Row Level Security (RLS) Supabase — à exécuter une fois via l'éditeur SQL
-- Supabase, en complément du schéma Prisma. Prisma ne gère pas la RLS.
--
-- Principe : le serveur applicatif se connecte avec un seul rôle Postgres (pas un rôle
-- par boutique), donc l'isolation ne peut pas reposer sur le rôle de connexion. À la
-- place, chaque requête doit fixer une variable de session `app.current_shop` au début
-- de la transaction, et les politiques RLS ci-dessous filtrent dessus. C'est un filet
-- de sécurité en plus du filtrage applicatif (WHERE shopDomain = ...) documenté dans
-- docs/phase-2-architecture.md — si le code applicatif oublie un filtre, la base refuse
-- quand même de renvoyer les lignes d'une autre boutique.

alter table "Boutique" enable row level security;
alter table "LigneLivre" enable row level security;

create policy boutique_isolee_par_shop
  on "Boutique"
  using ("shopDomain" = current_setting('app.current_shop', true));

create policy ligne_livre_isolee_par_shop
  on "LigneLivre"
  using ("shopDomain" = current_setting('app.current_shop', true));

-- Côté application, avant toute requête Prisma sur ces tables, dans la même transaction :
--   await tx.$executeRawUnsafe(`SELECT set_config('app.current_shop', $1, true)`, shopDomain);
-- `true` (le 3e argument de set_config) rend le réglage local à la transaction : il ne
-- fuit jamais vers une autre requête concurrente sur la même connexion poolée.
