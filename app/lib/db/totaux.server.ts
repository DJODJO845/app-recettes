import type { TypeActivite as TypeActivitePrisma } from "@prisma/client";
import { calculerCAPeriode } from "../domain/livreDesRecettes";
import { niveauAlertePlafond, type NiveauAlertePlafond, type TypeActivite as TypeActiviteReglementation } from "../domain/reglementation";
import { periodeCourante, type PeriodeCourante } from "../domain/periode";
import { composantesParis, debutDeJourParis, finDeJourParis, nombreJoursDuMois } from "../domain/fuseauParis";
import { listerLignes } from "./lignesLivre.server";

export type { PeriodeCourante };
export { periodeCourante };

export interface TotauxDashboard {
  caPeriodeCourante: number;
  periode: PeriodeCourante;
  caAnnuelEncaisse: number;
  niveauAlerte: NiveauAlertePlafond;
}

export interface PointEvolutionMensuelle {
  label: string;
  ca: number;
}

/** CA encaissé mois par mois sur les `nombreMois` derniers mois (mois courant inclus), pour le graphique du Dashboard. */
export async function calculerEvolutionMensuelle(
  shopDomain: string,
  nombreMois: number,
  maintenant = new Date(),
): Promise<PointEvolutionMensuelle[]> {
  // Calculs en heure de Paris (fuseauParis.ts), jamais en UTC ni en heure du serveur :
  // un mois calendaire est une notion française ici, cf. explication dans ce fichier.
  const { annee, mois } = composantesParis(maintenant);

  const debut = debutDeJourParis(annee, mois - (nombreMois - 1), 1);
  const fin = finDeJourParis(annee, mois + 1, 0);
  const lignes = await listerLignes(shopDomain, { debut, fin });

  const points: PointEvolutionMensuelle[] = [];
  for (let i = nombreMois - 1; i >= 0; i--) {
    // annee/moisRelatif peuvent sortir de la plage 0-11 (mois négatif ou > 11) : Date.UTC
    // les normalise nativement, donc on relit les vraies composantes après coup plutôt
    // que de recalculer l'année/le mois à la main.
    const { annee: anneeDuMois, mois: moisDuMois } = composantesDuMoisRelatif(annee, mois - i);
    const moisDebut = debutDeJourParis(anneeDuMois, moisDuMois, 1);
    const moisFin = finDeJourParis(anneeDuMois, moisDuMois, nombreJoursDuMois(anneeDuMois, moisDuMois));
    points.push({
      label: new Date(Date.UTC(anneeDuMois, moisDuMois, 1)).toLocaleDateString("fr-FR", {
        month: "short",
        timeZone: "UTC",
      }),
      ca: calculerCAPeriode(lignes, moisDebut, moisFin),
    });
  }
  return points;
}

/** Normalise une année/mois où le mois peut sortir de 0-11 (ex. mois = -2 ou 13). */
function composantesDuMoisRelatif(annee: number, moisIndex0: number): { annee: number; mois: number } {
  const normalise = new Date(Date.UTC(annee, moisIndex0, 1));
  return { annee: normalise.getUTCFullYear(), mois: normalise.getUTCMonth() };
}

export async function calculerTotauxDashboard(
  shopDomain: string,
  periodicite: "MENSUELLE" | "TRIMESTRIELLE",
  typeActivite: TypeActivitePrisma,
  maintenant = new Date(),
): Promise<TotauxDashboard> {
  const periode = periodeCourante(periodicite, maintenant);
  const { annee } = composantesParis(maintenant);
  const debutAnnee = debutDeJourParis(annee, 0, 1);
  const finAnnee = finDeJourParis(annee, 11, 31);

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
