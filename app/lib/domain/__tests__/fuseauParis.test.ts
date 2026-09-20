import { describe, expect, it } from "vitest";
import {
  composantesParis,
  debutDeJourParis,
  finDeJourParis,
  nombreJoursDuMois,
  veilleCalendaire,
} from "../fuseauParis";

describe("composantesParis", () => {
  it("bascule sur le jour suivant en heure de Paris, même si c'est encore la veille en UTC (hiver, UTC+1)", () => {
    // 23h30 UTC le 1er janvier = 00h30 heure de Paris le 2 janvier.
    const date = new Date("2026-01-01T23:30:00.000Z");
    expect(composantesParis(date)).toEqual({ annee: 2026, mois: 0, jour: 2 });
  });

  it("bascule sur le jour suivant en heure de Paris en été (UTC+2, heure d'été)", () => {
    // 22h30 UTC le 1er juillet = 00h30 heure de Paris (été, +2h) le 2 juillet.
    const date = new Date("2026-07-01T22:30:00.000Z");
    expect(composantesParis(date)).toEqual({ annee: 2026, mois: 6, jour: 2 });
  });

  it("reste sur le même jour en pleine journée", () => {
    const date = new Date("2026-06-15T12:00:00.000Z");
    expect(composantesParis(date)).toEqual({ annee: 2026, mois: 5, jour: 15 });
  });
});

describe("debutDeJourParis / finDeJourParis", () => {
  it("calcule le bon instant UTC pour minuit heure de Paris en hiver (+1h)", () => {
    const debut = debutDeJourParis(2026, 0, 1); // 1er janvier 2026, minuit Paris
    expect(debut.toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });

  it("calcule le bon instant UTC pour minuit heure de Paris en été (+2h)", () => {
    const debut = debutDeJourParis(2026, 6, 1); // 1er juillet 2026, minuit Paris (été)
    expect(debut.toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("calcule le bon instant UTC pour la fin de journée (23:59:59.999) heure de Paris", () => {
    const fin = finDeJourParis(2026, 0, 31); // 31 janvier 2026, 23:59:59.999 Paris
    expect(fin.toISOString()).toBe("2026-01-31T22:59:59.999Z");
  });

  it("reste correct de part et d'autre du passage à l'heure d'été (dernier dimanche de mars)", () => {
    // Changement d'heure 2026 : nuit du 28 au 29 mars, 2h -> 3h (le jour perd 1h).
    const avant = debutDeJourParis(2026, 2, 28); // encore en hiver (+1h)
    const apres = debutDeJourParis(2026, 2, 30); // déjà en été (+2h)
    expect(avant.toISOString()).toBe("2026-03-27T23:00:00.000Z");
    expect(apres.toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("reste correct de part et d'autre du passage à l'heure d'hiver (dernier dimanche d'octobre)", () => {
    // Changement d'heure 2026 : nuit du 24 au 25 octobre, 3h -> 2h (le jour gagne 1h).
    const avant = debutDeJourParis(2026, 9, 24); // encore en été (+2h)
    const apres = debutDeJourParis(2026, 9, 26); // déjà en hiver (+1h)
    expect(avant.toISOString()).toBe("2026-10-23T22:00:00.000Z");
    expect(apres.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("fait un aller-retour cohérent avec composantesParis sur toute une année, jour par jour", () => {
    for (let mois = 0; mois < 12; mois++) {
      const jours = nombreJoursDuMois(2026, mois);
      for (let jour = 1; jour <= jours; jour++) {
        const debut = debutDeJourParis(2026, mois, jour);
        expect(composantesParis(debut)).toEqual({ annee: 2026, mois, jour });
      }
    }
  });
});

describe("veilleCalendaire", () => {
  it("recule d'un jour dans le même mois", () => {
    expect(veilleCalendaire({ annee: 2026, mois: 8, jour: 20 })).toEqual({ annee: 2026, mois: 8, jour: 19 });
  });

  it("passe au mois précédent en début de mois", () => {
    expect(veilleCalendaire({ annee: 2026, mois: 2, jour: 1 })).toEqual({ annee: 2026, mois: 1, jour: 28 });
  });

  it("passe à l'année précédente au 1er janvier", () => {
    expect(veilleCalendaire({ annee: 2026, mois: 0, jour: 1 })).toEqual({ annee: 2025, mois: 11, jour: 31 });
  });

  it("gère correctement une année bissextile", () => {
    expect(veilleCalendaire({ annee: 2028, mois: 2, jour: 1 })).toEqual({ annee: 2028, mois: 1, jour: 29 });
  });
});

describe("nombreJoursDuMois", () => {
  it("connaît le nombre de jours de chaque mois d'une année non bissextile", () => {
    expect(nombreJoursDuMois(2026, 1)).toBe(28); // février 2026
    expect(nombreJoursDuMois(2026, 3)).toBe(30); // avril
    expect(nombreJoursDuMois(2026, 0)).toBe(31); // janvier
  });

  it("connaît février d'une année bissextile", () => {
    expect(nombreJoursDuMois(2028, 1)).toBe(29);
  });
});
