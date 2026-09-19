import type { NatureLigne } from "@prisma/client";
import type { LigneLivreDesRecettes, NatureLigneLivre } from "../domain/types";
import { executerAvecContexteBoutique } from "./rls.server";

const NATURE_VERS_PRISMA: Record<NatureLigneLivre, NatureLigne> = {
  vente: "VENTE",
  vente_carte_cadeau: "VENTE_CARTE_CADEAU",
  reglement_carte_cadeau: "REGLEMENT_CARTE_CADEAU",
  remboursement: "REMBOURSEMENT",
};

const NATURE_DEPUIS_PRISMA: Record<NatureLigne, NatureLigneLivre> = {
  VENTE: "vente",
  VENTE_CARTE_CADEAU: "vente_carte_cadeau",
  REGLEMENT_CARTE_CADEAU: "reglement_carte_cadeau",
  REMBOURSEMENT: "remboursement",
};

/**
 * Enregistre les lignes construites par `construireLignesLivre` (import Shopify),
 * en ignorant celles déjà présentes (idempotence via `transactionId` unique) — une
 * ligne du livre n'est jamais modifiée après création (section 3 du cahier des charges).
 */
export async function enregistrerLignes(
  shopDomain: string,
  lignes: LigneLivreDesRecettes[],
): Promise<number> {
  if (lignes.length === 0) return 0;

  const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.ligneLivre.createMany({
      data: lignes.map((ligne) => ({
        shopDomain,
        transactionId: ligne.id,
        dateEncaissement: new Date(ligne.date),
        reference: ligne.reference,
        client: ligne.client,
        clientId: ligne.clientId,
        nature: NATURE_VERS_PRISMA[ligne.nature],
        montant: ligne.montant,
        modeReglement: ligne.modeReglement,
        canal: ligne.canal,
        compteDansCA: ligne.compteDansCA,
        avertissement: ligne.avertissement,
      })),
      skipDuplicates: true,
    }),
  );

  return resultat.count;
}

export async function listerLignes(
  shopDomain: string,
  periode?: { debut: Date; fin: Date },
): Promise<LigneLivreDesRecettes[]> {
  const lignes = await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.ligneLivre.findMany({
      where: {
        shopDomain,
        ...(periode ? { dateEncaissement: { gte: periode.debut, lte: periode.fin } } : {}),
      },
      orderBy: { dateEncaissement: "asc" },
    }),
  );

  return lignes.map((ligne) => ({
    id: ligne.transactionId,
    date: ligne.dateEncaissement.toISOString(),
    reference: ligne.reference,
    client: ligne.client,
    clientId: ligne.clientId ?? undefined,
    nature: NATURE_DEPUIS_PRISMA[ligne.nature],
    montant: Number(ligne.montant),
    modeReglement: ligne.modeReglement,
    canal: ligne.canal,
    compteDansCA: ligne.compteDansCA,
    avertissement: ligne.avertissement ?? undefined,
  }));
}

/** Utilisé par le webhook `customers/data_request` : retrouve les lignes d'un client par son identifiant Shopify. */
export async function listerLignesParClientId(shopDomain: string, clientId: string): Promise<LigneLivreDesRecettes[]> {
  const toutesLesLignes = await listerLignes(shopDomain);
  return toutesLesLignes.filter((ligne) => ligne.clientId === clientId);
}

/** Utilisé par le webhook `customers/redact` : anonymise le nom sans supprimer la ligne (conservation légale 10 ans). */
export async function anonymiserLignesParClientId(shopDomain: string, clientId: string): Promise<number> {
  const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.ligneLivre.updateMany({
      where: { shopDomain, clientId },
      data: { client: "Client" },
    }),
  );
  return resultat.count;
}
