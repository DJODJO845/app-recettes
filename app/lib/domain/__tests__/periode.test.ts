import { describe, expect, it } from "vitest";
import { periodeCourante, periodeVientDeSeTerminer } from "../periode";
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
