import type { Periodicite, TypeActivite } from "@prisma/client";
import { executerAvecContexteBoutique } from "./rls.server";

export interface ReglagesBoutique {
  shopDomain: string;
  typeActivite: TypeActivite;
  periodicite: Periodicite;
  dateDebutActivite: Date;
}

/** Récupère les réglages de la boutique, ou les crée avec des valeurs par défaut. */
export async function obtenirOuCreerBoutique(shopDomain: string): Promise<ReglagesBoutique> {
  return executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.boutique.upsert({
      where: { shopDomain },
      update: {},
      create: {
        shopDomain,
        typeActivite: "COMMERCE",
        periodicite: "TRIMESTRIELLE",
        dateDebutActivite: new Date(),
      },
    }),
  );
}

export async function mettreAJourReglages(
  shopDomain: string,
  reglages: Partial<Pick<ReglagesBoutique, "typeActivite" | "periodicite" | "dateDebutActivite">>,
): Promise<ReglagesBoutique> {
  return executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.boutique.update({
      where: { shopDomain },
      data: reglages,
    }),
  );
}
