import { describe, expect, it } from "vitest";
import { genererCSV } from "../csv";
import type { LigneLivreDesRecettes } from "../../domain/types";

const ligne: LigneLivreDesRecettes = {
  id: "1",
  date: "2026-03-05T10:00:00Z",
  reference: "#1001",
  client: "Camille Dupont",
  nature: "vente",
  montant: 49.9,
  modeReglement: "Carte bancaire",
  canal: "web",
  compteDansCA: true,
};

describe("genererCSV", () => {
  it("inclut l'en-tête et une ligne par encaissement, avec virgule décimale française", () => {
    const csv = genererCSV([ligne]);
    const lignesCSV = csv.replace("﻿", "").split("\r\n");

    expect(lignesCSV[0]).toBe("Date;Référence;Client;Nature;Mode de règlement;Canal;Montant");
    expect(lignesCSV[1]).toContain("49,90");
    expect(lignesCSV[1]).toContain("Camille Dupont");
  });

  it("échappe les champs contenant un point-virgule ou des guillemets", () => {
    const ligneAvecPointVirgule = { ...ligne, client: 'Dupont; "Jean"' };
    const csv = genererCSV([ligneAvecPointVirgule]);

    expect(csv).toContain('"Dupont; ""Jean"""');
  });

  it("affiche la date en heure de Paris, pas en UTC (une vente juste après minuit heure de Paris ne doit pas apparaître à la date de la veille)", () => {
    // 23h30 UTC le 4 mars = 00h30 heure de Paris le 5 mars (hiver, +1h).
    const ligneMinuit = { ...ligne, date: "2026-03-04T23:30:00.000Z" };
    const csv = genererCSV([ligneMinuit]);
    const ligneCSV = csv.split("\r\n")[1];

    expect(ligneCSV).toContain("05/03/2026");
    expect(ligneCSV).not.toContain("04/03/2026");
  });

  it("traduit le canal Shopify brut en libellé français, jamais l'identifiant technique", () => {
    const ligneCanalBrut = { ...ligne, canal: "quick_sale" };
    const csv = genererCSV([ligneCanalBrut]);
    const ligneCSV = csv.split("\r\n")[1];

    expect(ligneCSV).toContain("Point de vente (vente rapide)");
    expect(ligneCSV).not.toContain("quick_sale");
  });

  it("échappe un champ contenant un retour chariot isolé (\\r sans \\n)", () => {
    const ligneAvecRetourChariot = { ...ligne, client: "Dupont\rJean" };
    const csv = genererCSV([ligneAvecRetourChariot]);

    expect(csv).toContain('"Dupont\rJean"');
  });
});
