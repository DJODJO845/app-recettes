import reglementation from "../../../config/reglementation.json" with { type: "json" };
import { composantesParis, debutDeJourParis, finDeJourParis } from "./fuseauParis";

export type TypeActivite = "commerce" | "services" | "mixte";

/**
 * Point d'accès unique aux chiffres réglementaires (plafonds, seuils d'alerte...).
 * Ne jamais dupliquer ces valeurs en dur ailleurs dans le code, cf. section 3 du
 * cahier des charges : `config/reglementation.json` est la seule source.
 */
export function plafondAnnuel(typeActivite: TypeActivite): number {
  if (typeActivite === "commerce") return reglementation.plafondsCA.commerce.montant;
  if (typeActivite === "services") return reglementation.plafondsCA.services.montant;
  return reglementation.plafondsCA.mixte.plafondGlobal;
}

export function seuilsAlerte(): { avertissement: number; critique: number } {
  return {
    avertissement: reglementation.seuilsAlerte.avertissement,
    critique: reglementation.seuilsAlerte.critique,
  };
}

export type NiveauAlertePlafond = "ok" | "avertissement" | "critique";

export function niveauAlertePlafond(caAnnuelEncaisse: number, typeActivite: TypeActivite): NiveauAlertePlafond {
  const plafond = plafondAnnuel(typeActivite);
  const ratio = plafond > 0 ? caAnnuelEncaisse / plafond : 0;
  const seuils = seuilsAlerte();
  if (ratio >= seuils.critique) return "critique";
  if (ratio >= seuils.avertissement) return "avertissement";
  return "ok";
}

/** Sous les 14 jours de recul, le rythme moyen observé n'est pas assez représentatif
 * pour projeter une date sans risquer d'alarmer (ou rassurer) à tort sur une
 * variation de court terme. */
const JOURS_MINIMUM_POUR_PROJETER = 14;

/**
 * Projette, au rythme d'encaissement moyen observé depuis le début de l'année (ou le
 * début d'activité si plus tardif), la date à laquelle le plafond annuel serait
 * atteint si ce rythme se maintenait. `null` quand la projection n'a pas de sens ou
 * n'apporte rien : pas assez de recul, aucun encaissement, plafond déjà atteint (le
 * Dashboard affiche déjà l'alerte critique pour ce cas), ou projection au-delà du 31
 * décembre (pas de risque identifié cette année, inutile d'inquiéter pour rien).
 */
export function projectionDatePlafond(
  caAnnuelEncaisse: number,
  plafond: number,
  dateDebutActivite: Date,
  maintenant: Date,
): Date | null {
  if (caAnnuelEncaisse <= 0 || plafond <= 0 || caAnnuelEncaisse >= plafond) return null;

  const { annee } = composantesParis(maintenant);
  const debutAnnee = debutDeJourParis(annee, 0, 1);
  const finAnnee = finDeJourParis(annee, 11, 31);
  const debutReference = new Date(Math.max(debutAnnee.getTime(), dateDebutActivite.getTime()));

  const joursEcoules = (maintenant.getTime() - debutReference.getTime()) / (24 * 60 * 60 * 1000);
  if (joursEcoules < JOURS_MINIMUM_POUR_PROJETER) return null;

  const tauxJournalier = caAnnuelEncaisse / joursEcoules;
  const joursRestants = (plafond - caAnnuelEncaisse) / tauxJournalier;
  const dateProjetee = new Date(maintenant.getTime() + joursRestants * 24 * 60 * 60 * 1000);

  return dateProjetee > finAnnee ? null : dateProjetee;
}
