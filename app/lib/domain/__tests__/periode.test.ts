import { describe, expect, it } from "vitest";
import { periodeCourante, periodeVientDeSeTerminer } from "../periode";

describe("periodeCourante", () => {
  it("calcule les bornes du mois pour une périodicité mensuelle", () => {
    const periode = periodeCourante("MENSUELLE", new Date(Date.UTC(2026, 8, 15)));
    expect(periode.debut.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(periode.fin.toISOString().slice(0, 10)).toBe("2026-09-30");
  });

  it("calcule les bornes du trimestre pour une périodicité trimestrielle", () => {
    const periode = periodeCourante("TRIMESTRIELLE", new Date(Date.UTC(2026, 8, 15)));
    expect(periode.debut.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(periode.fin.toISOString().slice(0, 10)).toBe("2026-09-30");
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
});
