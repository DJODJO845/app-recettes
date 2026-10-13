import {
  composantesParis,
  debutDeJourParis,
  finDeJourParis,
  nombreJoursDuMois,
  normaliserAnneeMois,
  veilleCalendaire,
} from "./fuseauParis";

export interface PeriodeCourante {
  debut: Date;
  fin: Date;
  label: string;
}

/**
 * Libellé du mois formaté à partir de composantes année/mois déjà connues (pas d'un
 * Date déjà converti en instant) : en formatant avec `timeZone: "UTC"` un Date
 * construit exprès via Date.UTC(annee, mois, 1), on est certain d'obtenir le libellé
 * du mois qu'on a demandé, quel que soit le fuseau du serveur qui exécute ce code.
 */
function labelMois(annee: number, moisIndex0: number): string {
  return new Date(Date.UTC(annee, moisIndex0, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function periodeDepuisComposantes(
  periodicite: "MENSUELLE" | "TRIMESTRIELLE",
  annee: number,
  moisIndex0: number,
): PeriodeCourante {
  if (periodicite === "MENSUELLE") {
    const debut = debutDeJourParis(annee, moisIndex0, 1);
    const fin = finDeJourParis(annee, moisIndex0, nombreJoursDuMois(annee, moisIndex0));
    return { debut, fin, label: labelMois(annee, moisIndex0) };
  }

  const trimestre = Math.floor(moisIndex0 / 3);
  const moisDebutTrimestre = trimestre * 3;
  const moisFinTrimestre = moisDebutTrimestre + 2;
  const debut = debutDeJourParis(annee, moisDebutTrimestre, 1);
  const fin = finDeJourParis(annee, moisFinTrimestre, nombreJoursDuMois(annee, moisFinTrimestre));
  return { debut, fin, label: `T${trimestre + 1} ${annee}` };
}

/**
 * Calcule les bornes de la période de déclaration en cours (mensuelle ou
 * trimestrielle), en heure de Paris — jamais en UTC ni en heure du serveur : voir
 * lib/domain/fuseauParis.ts pour l'explication de pourquoi ça compte.
 */
export function periodeCourante(periodicite: "MENSUELLE" | "TRIMESTRIELLE", maintenant = new Date()): PeriodeCourante {
  const { annee, mois } = composantesParis(maintenant);
  return periodeDepuisComposantes(periodicite, annee, mois);
}

/**
 * Période de déclaration décalée de `decalage` périodes par rapport à la période en
 * cours (0 = en cours, -1 = précédente, -2 = encore avant...) — pour naviguer entre
 * périodes dans l'export de déclaration, sans dupliquer les règles mois/trimestre
 * déjà posées dans periodeDepuisComposantes.
 */
export function periodeDecalee(
  periodicite: "MENSUELLE" | "TRIMESTRIELLE",
  decalage: number,
  maintenant = new Date(),
): PeriodeCourante {
  const { annee, mois } = composantesParis(maintenant);
  const pas = periodicite === "MENSUELLE" ? 1 : 3;
  const { annee: anneeDecalee, mois: moisDecale } = normaliserAnneeMois(annee, mois + decalage * pas);
  return periodeDepuisComposantes(periodicite, anneeDecalee, moisDecale);
}

/**
 * Interprète le paramètre d'URL `periode` (décalage choisi par le marchand, ex. dans
 * l'export de déclaration) en un entier valide pour periodeDecalee : jamais au-delà
 * de la période en cours (0, une période future n'a pas encore de CA à montrer), et
 * -1 par défaut — la période qui vient de se terminer, celle qu'on déclare normalement.
 */
export function decalagePeriodeDepuisParam(valeur: string | null): number {
  const brut = Number(valeur ?? "-1");
  return Number.isFinite(brut) ? Math.min(0, Math.trunc(brut)) : -1;
}

export interface VerificationEcheance {
  estDue: boolean;
  periode: PeriodeCourante;
}

/**
 * Vrai le lendemain du dernier jour d'une période de déclaration (en calendrier
 * français) : le jour où prévenir le marchand que sa période vient de se terminer
 * et qu'il peut la déclarer. On ne prétend pas connaître la date limite exacte de
 * dépôt URSSAF (variable, et une erreur ici serait trompeuse) — on informe
 * seulement que la période elle-même est close, avec le montant à déclarer.
 */
export function periodeVientDeSeTerminer(
  periodicite: "MENSUELLE" | "TRIMESTRIELLE",
  maintenant = new Date(),
): VerificationEcheance {
  const aujourdHui = composantesParis(maintenant);
  const hier = veilleCalendaire(aujourdHui);

  const periode = periodeDepuisComposantes(periodicite, hier.annee, hier.mois);
  const dernierJourDeLaPeriode = composantesParis(periode.fin);
  const estDue =
    dernierJourDeLaPeriode.annee === hier.annee &&
    dernierJourDeLaPeriode.mois === hier.mois &&
    dernierJourDeLaPeriode.jour === hier.jour;

  return { estDue, periode };
}
