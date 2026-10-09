import { describe, expect, it } from "vitest";
import { niveauAlertePlafond, plafondAnnuel, projectionDatePlafond, seuilsAlerte } from "../reglementation";

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

describe("projectionDatePlafond", () => {
  const debutActiviteAncienne = new Date("2020-01-01T12:00:00Z");

  it("retourne null sans aucun encaissement", () => {
    const maintenant = new Date("2026-03-15T12:00:00Z");
    expect(projectionDatePlafond(0, 83600, debutActiviteAncienne, maintenant)).toBeNull();
  });

  it("retourne null quand le plafond est déjà atteint", () => {
    const maintenant = new Date("2026-03-15T12:00:00Z");
    expect(projectionDatePlafond(90000, 83600, debutActiviteAncienne, maintenant)).toBeNull();
  });

  it("retourne null sous les 14 jours de recul", () => {
    const maintenant = new Date("2026-03-15T12:00:00Z");
    const debutActiviteRecente = new Date("2026-03-10T12:00:00Z");
    expect(projectionDatePlafond(1000, 83600, debutActiviteRecente, maintenant)).toBeNull();
  });

  it("projette une date dans l'année courante au rythme moyen observé", () => {
    // 20 000 € encaissés sur les 73 premiers jours de l'année (1er janv. -> 15 mars) :
    // au même rythme, le plafond services (83 600 €) serait atteint vers la fin
    // novembre, donc avant le 31 décembre.
    const maintenant = new Date("2026-03-15T12:00:00Z");
    const dateProjetee = projectionDatePlafond(20000, 83600, debutActiviteAncienne, maintenant);
    expect(dateProjetee).not.toBeNull();
    expect(dateProjetee!.getUTCFullYear()).toBe(2026);
    expect(dateProjetee!.getTime()).toBeGreaterThan(maintenant.getTime());
  });

  it("retourne null quand la projection dépasse le 31 décembre", () => {
    // Rythme très faible en fin d'année : la projection dépasserait largement le 31
    // décembre de l'année courante, donc aucune date n'est affichée.
    const maintenant = new Date("2026-12-01T12:00:00Z");
    const dateProjetee = projectionDatePlafond(1000, 83600, debutActiviteAncienne, maintenant);
    expect(dateProjetee).toBeNull();
  });

  it("utilise dateDebutActivite comme point de départ quand elle est postérieure au 1er janvier", () => {
    // Activité démarrée le 1er février 2026 : le rythme doit être calculé depuis cette
    // date, pas depuis le 1er janvier (sinon le rythme serait sous-estimé).
    const debutActiviteRecente = new Date("2026-02-01T12:00:00Z");
    const maintenant = new Date("2026-03-15T12:00:00Z"); // 42 jours depuis le 1er février
    const dateProjetee = projectionDatePlafond(20000, 83600, debutActiviteRecente, maintenant);
    expect(dateProjetee).not.toBeNull();
    expect(dateProjetee!.getTime()).toBeGreaterThan(maintenant.getTime());
  });
});
