export interface PeriodeCourante {
  debut: Date;
  fin: Date;
  label: string;
}

/** Calcule les bornes de la période de déclaration en cours (mensuelle ou trimestrielle). */
export function periodeCourante(periodicite: "MENSUELLE" | "TRIMESTRIELLE", maintenant = new Date()): PeriodeCourante {
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth();

  if (periodicite === "MENSUELLE") {
    const debut = new Date(Date.UTC(annee, mois, 1));
    const fin = new Date(Date.UTC(annee, mois + 1, 0, 23, 59, 59));
    return { debut, fin, label: debut.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
  }

  const trimestre = Math.floor(mois / 3);
  const debut = new Date(Date.UTC(annee, trimestre * 3, 1));
  const fin = new Date(Date.UTC(annee, trimestre * 3 + 3, 0, 23, 59, 59));
  return { debut, fin, label: `T${trimestre + 1} ${annee}` };
}

export interface VerificationEcheance {
  estDue: boolean;
  periode: PeriodeCourante;
}

/**
 * Vrai le lendemain du dernier jour d'une période de déclaration : le jour où
 * prévenir le marchand que sa période vient de se terminer et qu'il peut la
 * déclarer. On ne prétend pas connaître la date limite exacte de dépôt URSSAF
 * (variable, et une erreur ici serait trompeuse) — on informe seulement que la
 * période elle-même est close, avec le montant à déclarer.
 */
export function periodeVientDeSeTerminer(
  periodicite: "MENSUELLE" | "TRIMESTRIELLE",
  maintenant = new Date(),
): VerificationEcheance {
  const hier = new Date(maintenant);
  hier.setUTCDate(hier.getUTCDate() - 1);

  const periode = periodeCourante(periodicite, hier);
  const estDue = periode.fin.toISOString().slice(0, 10) === hier.toISOString().slice(0, 10);

  return { estDue, periode };
}
