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
});
