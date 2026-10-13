import type { TypeActivite as TypeActivitePrisma } from "@prisma/client";
import { calculerCAPeriode } from "../domain/livreDesRecettes";
import { niveauAlertePlafond, type NiveauAlertePlafond, type TypeActivite as TypeActiviteReglementation } from "../domain/reglementation";
import { periodeCourante, type PeriodeCourante } from "../domain/periode";
import { composantesParis, debutDeJourParis, finDeJourParis, nombreJoursDuMois, normaliserAnneeMois } from "../domain/fuseauParis";
import { listerLignes } from "./lignesLivre.server";

export interface ComparaisonAnnuelle {
  caAnneeCourante: number;
  caAnneePrecedente: number;
  /** null si rien n'a été encaissé à la même date l'an dernier (division par zéro évitée). */
  variationPourcent: number | null;
}

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
    const { annee: anneeDuMois, mois: moisDuMois } = normaliserAnneeMois(annee, mois - i);
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

/**
 * Compare le CA encaissé depuis le 1er janvier à celui encaissé sur la même plage
 * l'année précédente (du 1er janvier à la même date calendaire), pour donner du
 * contexte au Dashboard plutôt qu'un chiffre isolé. `null` sur `variationPourcent`
 * si rien n'a été encaissé l'an dernier à cette date (boutique trop récente, ou
 * activité qui vient de démarrer) : un pourcentage de variation n'aurait pas de sens.
 */
export async function calculerComparaisonAnnuelle(
  shopDomain: string,
  maintenant = new Date(),
): Promise<ComparaisonAnnuelle> {
  const { annee, mois, jour } = composantesParis(maintenant);

  const debutAnneeCourante = debutDeJourParis(annee, 0, 1);
  const finAujourdhui = finDeJourParis(annee, mois, jour);
  const debutAnneePrecedente = debutDeJourParis(annee - 1, 0, 1);
  const finMemeDateAnneePrecedente = finDeJourParis(annee - 1, mois, jour);

  const [lignesAnneeCourante, lignesAnneePrecedente] = await Promise.all([
    listerLignes(shopDomain, { debut: debutAnneeCourante, fin: finAujourdhui }),
    listerLignes(shopDomain, { debut: debutAnneePrecedente, fin: finMemeDateAnneePrecedente }),
  ]);

  const caAnneeCourante = calculerCAPeriode(lignesAnneeCourante, debutAnneeCourante, finAujourdhui);
  const caAnneePrecedente = calculerCAPeriode(lignesAnneePrecedente, debutAnneePrecedente, finMemeDateAnneePrecedente);

  return {
    caAnneeCourante,
    caAnneePrecedente,
    variationPourcent:
      caAnneePrecedente > 0 ? Math.round(((caAnneeCourante - caAnneePrecedente) / caAnneePrecedente) * 100) : null,
  };
}
