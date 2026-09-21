import { describe, expect, it } from "vitest";
import { joursDepuis, libelleDernierExport } from "../dateRelative";

describe("joursDepuis", () => {
  it("compte le nombre de jours pleins écoulés", () => {
    const maintenant = new Date("2026-09-21T10:00:00Z");
    expect(joursDepuis(new Date("2026-09-18T10:00:00Z"), maintenant)).toBe(3);
  });
});

describe("libelleDernierExport", () => {
  const maintenant = new Date("2026-09-21T10:00:00Z");

  it("indique qu'aucun export n'a jamais eu lieu", () => {
    expect(libelleDernierExport(null, maintenant)).toBe("Jamais exporté depuis l'installation de l'app.");
  });

  it("distingue aujourd'hui, hier, et il y a N jours", () => {
    expect(libelleDernierExport(new Date("2026-09-21T08:00:00Z"), maintenant)).toBe("Dernier export : aujourd'hui.");
    expect(libelleDernierExport(new Date("2026-09-20T08:00:00Z"), maintenant)).toBe("Dernier export : hier.");
    expect(libelleDernierExport(new Date("2026-09-15T08:00:00Z"), maintenant)).toBe("Dernier export : il y a 6 jours.");
  });
});
