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

