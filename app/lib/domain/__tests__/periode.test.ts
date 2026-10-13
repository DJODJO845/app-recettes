import { describe, expect, it } from "vitest";
import { decalagePeriodeDepuisParam, periodeCourante, periodeDecalee, periodeVientDeSeTerminer } from "../periode";
import { composantesParis } from "../fuseauParis";

describe("periodeCourante", () => {
  it("calcule les bornes du mois pour une périodicité mensuelle, en heure de Paris", () => {
    const periode = periodeCourante("MENSUELLE", new Date(Date.UTC(2026, 8, 15)));
    expect(composantesParis(periode.debut)).toEqual({ annee: 2026, mois: 8, jour: 1 });
    expect(composantesParis(periode.fin)).toEqual({ annee: 2026, mois: 8, jour: 30 });
    expect(periode.label).toContain("septembre");
  });

  it("calcule les bornes du trimestre pour une périodicité trimestrielle, en heure de Paris", () => {
    const periode = periodeCourante("TRIMESTRIELLE", new Date(Date.UTC(2026, 8, 15)));
    expect(composantesParis(periode.debut)).toEqual({ annee: 2026, mois: 6, jour: 1 });
    expect(composantesParis(periode.fin)).toEqual({ annee: 2026, mois: 8, jour: 30 });
    expect(periode.label).toBe("T3 2026");
  });

  it("place correctement une vente de tout début de journée heure de Paris dans le bon mois, même si c'est encore la veille en UTC", () => {
    // 23h30 UTC le 30 septembre = 00h30 heure de Paris le 1er octobre (été, +2h) :
    // sans la correction de fuseau, ça retomberait à tort en septembre.
    const maintenant = new Date("2026-09-30T23:30:00.000Z");
    const periode = periodeCourante("MENSUELLE", maintenant);
    expect(composantesParis(periode.debut)).toEqual({ annee: 2026, mois: 9, jour: 1 });
  });
});

describe("periodeVientDeSeTerminer", () => {
  it("est due le lendemain du dernier jour d'un mois", () => {
    const { estDue, periode } = periodeVientDeSeTerminer("MENSUELLE", new Date(Date.UTC(2026, 9, 1)));
    expect(estDue).toBe(true);
    expect(periode.label).toContain("septembre");
  });

  it("n'est pas due en milieu de mois", () => {
    const { estDue } = periodeVientDeSeTerminer("MENSUELLE", new Date(Date.UTC(2026, 8, 15)));
    expect(estDue).toBe(false);
  });

  it("est due le lendemain du dernier jour d'un trimestre", () => {
    const { estDue, periode } = periodeVientDeSeTerminer("TRIMESTRIELLE", new Date(Date.UTC(2026, 9, 1)));
    expect(estDue).toBe(true);
    expect(periode.label).toBe("T3 2026");
  });

  it("n'est pas due au milieu d'un trimestre", () => {
    const { estDue } = periodeVientDeSeTerminer("TRIMESTRIELLE", new Date(Date.UTC(2026, 8, 15)));
    expect(estDue).toBe(false);
  });

  it("reste correcte pile au changement d'heure d'hiver (dernier dimanche d'octobre)", () => {
    // Le 25 octobre 2026 est le dernier jour du mois... non, le 31 l'est. On vérifie
    // simplement que le calcul de "veille" traverse correctement le changement
    // d'heure du 24->25 octobre 2026 sans décaler le jour calendaire.
    const lendemainDuChangementDHeure = new Date("2026-10-26T05:00:00.000Z");
    const { estDue } = periodeVientDeSeTerminer("MENSUELLE", lendemainDuChangementDHeure);
    expect(estDue).toBe(false); // le 25 n'est pas le dernier jour d'octobre
  });
});

describe("periodeDecalee", () => {
  it("un décalage de 0 redonne la période en cours", () => {
    const maintenant = new Date(Date.UTC(2026, 8, 15));
    expect(periodeDecalee("MENSUELLE", 0, maintenant)).toEqual(periodeCourante("MENSUELLE", maintenant));
  });

  it("décale d'un mois en arrière pour une périodicité mensuelle", () => {
    const periode = periodeDecalee("MENSUELLE", -1, new Date(Date.UTC(2026, 8, 15)));
    expect(composantesParis(periode.debut)).toEqual({ annee: 2026, mois: 7, jour: 1 });
    expect(periode.label).toContain("août");
  });

  it("décale d'un trimestre en arrière pour une périodicité trimestrielle", () => {
    const periode = periodeDecalee("TRIMESTRIELLE", -1, new Date(Date.UTC(2026, 8, 15)));
    expect(periode.label).toBe("T2 2026");
  });

  it("traverse correctement la frontière d'année en arrière", () => {
    const periode = periodeDecalee("MENSUELLE", -2, new Date(Date.UTC(2026, 0, 15)));
    expect(composantesParis(periode.debut)).toEqual({ annee: 2025, mois: 10, jour: 1 });
    expect(periode.label).toContain("2025");
  });

  it("traverse correctement la frontière d'année en avant", () => {
    const periode = periodeDecalee("TRIMESTRIELLE", 1, new Date(Date.UTC(2026, 10, 15)));
    expect(periode.label).toBe("T1 2027");
  });
});

describe("decalagePeriodeDepuisParam", () => {
  it("vaut -1 par défaut (la période qui vient de se terminer)", () => {
    expect(decalagePeriodeDepuisParam(null)).toBe(-1);
  });

  it("accepte un décalage négatif valide", () => {
    expect(decalagePeriodeDepuisParam("-3")).toBe(-3);
  });

  it("plafonne à 0, jamais une période future", () => {
    expect(decalagePeriodeDepuisParam("5")).toBe(0);
    expect(decalagePeriodeDepuisParam("0")).toBe(0);
  });

  it("retombe sur -1 pour une valeur non numérique", () => {
    expect(decalagePeriodeDepuisParam("abc")).toBe(-1);
  });

  it("tronque une valeur décimale", () => {
    expect(decalagePeriodeDepuisParam("-2.7")).toBe(-2);
  });
});
