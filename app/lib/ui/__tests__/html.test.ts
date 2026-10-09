import { describe, expect, it } from "vitest";
import { echapperHTML } from "../html";

describe("echapperHTML", () => {
  it("échappe les caractères spéciaux HTML", () => {
    expect(echapperHTML('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("échappe l'esperluette et l'apostrophe", () => {
    expect(echapperHTML("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });

  it("laisse inchangé un texte sans caractère spécial", () => {
    expect(echapperHTML("Commande #1015")).toBe("Commande #1015");
  });
});
