import type { TypeActivite as TypeActivitePrisma } from "@prisma/client";
import { calculerCAPeriode } from "../domain/livreDesRecettes";
import { niveauAlertePlafond, type NiveauAlertePlafond, type TypeActivite as TypeActiviteReglementation } from "../domain/reglementation";
import { listerLignes } from "./lignesLivre.server";

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

export interface TotauxDashboard {
  caPeriodeCourante: number;
  periode: PeriodeCourante;
  caAnnuelEncaisse: number;
  niveauAlerte: NiveauAlertePlafond;
}

export async function calculerTotauxDashboard(
  shopDomain: string,
  periodicite: "MENSUELLE" | "TRIMESTRIELLE",
  typeActivite: TypeActivitePrisma,
  maintenant = new Date(),
): Promise<TotauxDashboard> {
  const periode = periodeCourante(periodicite, maintenant);
  const debutAnnee = new Date(Date.UTC(maintenant.getUTCFullYear(), 0, 1));
  const finAnnee = new Date(Date.UTC(maintenant.getUTCFullYear(), 11, 31, 23, 59, 59));

  const lignesAnnee = await listerLignes(shopDomain, { debut: debutAnnee, fin: finAnnee });

  const caPeriodeCourante = calculerCAPeriode(lignesAnnee, periode.debut, periode.fin);
  const caAnnuelEncaisse = calculerCAPeriode(lignesAnnee, debutAnnee, finAnnee);

  return {
    caPeriodeCourante,
    periode,
    caAnnuelEncaisse,
    niveauAlerte: niveauAlertePlafond(caAnnuelEncaisse, typeActivite.toLowerCase() as TypeActiviteReglementation),
  };
}
