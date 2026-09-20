import type { Periodicite, TypeActivite } from "@prisma/client";
import { executerAvecContexteBoutique } from "./rls.server";

export interface ReglagesBoutique {
  shopDomain: string;
  typeActivite: TypeActivite;
  periodicite: Periodicite;
  dateDebutActivite: Date;
  emailRappel: string | null;
  derniereExportation: Date | null;
  derniereImportation: Date | null;
}

// `dateDebutActivite` borne l'import des commandes Shopify (voir
// importerCommandesRecentes) : à la création, la mettre à "maintenant" ferait
// que l'import ne récupère RIEN (aucune commande n'a encore été passée après
// cet instant précis) — un nouvel utilisateur ouvrirait un Dashboard vide sans
// comprendre pourquoi, alors même qu'il a déjà des ventes. On part donc de 60
// jours en arrière par défaut : c'est la profondeur maximale accessible sans
// l'approbation du scope protégé `read_all_orders` (cf. docs/phase-2-architecture.md),
// donc ça maximise ce qui s'importe tout de suite sans action du marchand.
// Une fois `read_all_orders` approuvé, il peut reculer cette date dans Réglages
// pour récupérer un historique plus ancien.
const NOMBRE_JOURS_HISTORIQUE_PAR_DEFAUT = 60;

/** Récupère les réglages de la boutique, ou les crée avec des valeurs par défaut. */
export async function obtenirOuCreerBoutique(shopDomain: string): Promise<ReglagesBoutique> {
  const dateDebutParDefaut = new Date();
  dateDebutParDefaut.setUTCDate(dateDebutParDefaut.getUTCDate() - NOMBRE_JOURS_HISTORIQUE_PAR_DEFAUT);

  return executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.boutique.upsert({
      where: { shopDomain },
      update: {},
      create: {
        shopDomain,
        typeActivite: "COMMERCE",
        periodicite: "TRIMESTRIELLE",
        dateDebutActivite: dateDebutParDefaut,
      },
    }),
  );
}

export async function mettreAJourReglages(
  shopDomain: string,
  reglages: Partial<Pick<ReglagesBoutique, "typeActivite" | "periodicite" | "dateDebutActivite" | "emailRappel">>,
): Promise<ReglagesBoutique> {
  return executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.boutique.update({
      where: { shopDomain },
      data: {
        ...reglages,
        // Un changement de date de début d'activité invalide l'import incrémental :
        // sans ce reset, la prochaine visite du Dashboard repartirait de
        // derniereImportation (récente) plutôt que de la nouvelle dateDebutActivite
        // (potentiellement bien plus ancienne), et l'historique nouvellement demandé
        // ne serait jamais importé.
        ...(reglages.dateDebutActivite ? { derniereImportation: null } : {}),
      },
    }),
  );
}

/** Appelé par les routes d'export (CSV, PDF) pour ne plus afficher BanniereExport inutilement. */
export async function enregistrerExportation(shopDomain: string): Promise<void> {
  await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.boutique.update({
      where: { shopDomain },
      data: { derniereExportation: new Date() },
    }),
  );
}

/** Appelé après un import réussi des commandes Shopify (voir app._index.tsx), pour rendre les imports suivants incrémentaux. */
export async function enregistrerImportation(shopDomain: string): Promise<void> {
  await executerAvecContexteBoutique(shopDomain, (tx) =>
    tx.boutique.update({
      where: { shopDomain },
      data: { derniereImportation: new Date() },
    }),
  );
}
