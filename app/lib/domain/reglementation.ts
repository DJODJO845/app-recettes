import reglementation from "../../../config/reglementation.json" with { type: "json" };

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
