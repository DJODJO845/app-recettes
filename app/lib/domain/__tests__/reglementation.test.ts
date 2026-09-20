import { describe, expect, it } from "vitest";
import { niveauAlertePlafond, plafondAnnuel, seuilsAlerte } from "../reglementation";

describe("plafondAnnuel", () => {
  it("retourne le plafond commerce", () => {
    expect(plafondAnnuel("commerce")).toBe(203100);
  });

  it("retourne le plafond services", () => {
    expect(plafondAnnuel("services")).toBe(83600);
  });

  it("retourne le plafond global pour une activité mixte", () => {
    expect(plafondAnnuel("mixte")).toBe(203100);
  });
});

describe("seuilsAlerte", () => {
  it("retourne les seuils configurés", () => {
    expect(seuilsAlerte()).toEqual({ avertissement: 0.8, critique: 0.95 });
  });
});

describe("niveauAlertePlafond", () => {
  it("est \"ok\" à 0 €", () => {
    expect(niveauAlertePlafond(0, "commerce")).toBe("ok");
  });

  it("est \"ok\" juste en dessous du seuil d'avertissement (80 %)", () => {
    const montant = 203100 * 0.8 - 1;
    expect(niveauAlertePlafond(montant, "commerce")).toBe("ok");
  });

  it("est \"avertissement\" pile au seuil de 80 %", () => {
    const montant = 203100 * 0.8;
    expect(niveauAlertePlafond(montant, "commerce")).toBe("avertissement");
  });

  it("est \"avertissement\" juste en dessous du seuil critique (95 %)", () => {
    const montant = 203100 * 0.95 - 1;
    expect(niveauAlertePlafond(montant, "commerce")).toBe("avertissement");
  });

  it("est \"critique\" pile au seuil de 95 %", () => {
    const montant = 203100 * 0.95;
    expect(niveauAlertePlafond(montant, "commerce")).toBe("critique");
  });

  it("reste \"critique\" au-delà de 100 % du plafond", () => {
    expect(niveauAlertePlafond(203100 * 1.5, "commerce")).toBe("critique");
  });

  it("applique le bon plafond selon le type d'activité (services, plus bas que commerce)", () => {
    const montant = 90000; // > plafond services (83 600) mais < plafond commerce (203 100)
    expect(niveauAlertePlafond(montant, "services")).toBe("critique");
    expect(niveauAlertePlafond(montant, "commerce")).toBe("ok");
  });
});
