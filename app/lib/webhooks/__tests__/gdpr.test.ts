import { describe, expect, it } from "vitest";
import {
  traiterDemandeDonneesClient,
  traiterEffacementBoutique,
  traiterEffacementClient,
  type DepotLignesLivre,
} from "../gdpr";
import type { LigneLivreDesRecettes } from "../../domain/types";

function depotEnMemoire(lignesInitiales: LigneLivreDesRecettes[]): DepotLignesLivre & { lignes: LigneLivreDesRecettes[] } {
  const lignes = [...lignesInitiales];
  return {
    lignes,
    async listerParClient(_shopDomain, nomClient) {
      return lignes.filter((l) => l.client === nomClient);
    },
    async anonymiserClient(_shopDomain, nomClient) {
      let compte = 0;
      for (const ligne of lignes) {
        if (ligne.client === nomClient) {
          ligne.client = "Client";
          compte++;
        }
      }
      return compte;
    },
    async supprimerToutesLesLignes() {
      const compte = lignes.length;
      lignes.length = 0;
      return compte;
    },
  };
}

const ligneExemple = (client: string): LigneLivreDesRecettes => ({
  id: `l-${client}`,
  date: "2026-03-01T00:00:00Z",
  reference: "#1000",
  client,
  nature: "vente",
  montant: 10,
  modeReglement: "Carte bancaire",
  canal: "web",
  compteDansCA: true,
});

describe("webhooks RGPD", () => {
  it("customers/data_request renvoie uniquement les lignes du client demandeur", async () => {
    const depot = depotEnMemoire([ligneExemple("Camille Dupont"), ligneExemple("Autre Client")]);

    const resultat = await traiterDemandeDonneesClient(depot, "boutique.myshopify.com", "Camille Dupont");

    expect(resultat).toHaveLength(1);
    expect(resultat[0]?.client).toBe("Camille Dupont");
  });

  it("customers/redact anonymise le nom sans supprimer la ligne (conservation légale 10 ans)", async () => {
    const depot = depotEnMemoire([ligneExemple("Camille Dupont")]);

    const compte = await traiterEffacementClient(depot, "boutique.myshopify.com", "Camille Dupont");

    expect(compte).toBe(1);
    expect(depot.lignes).toHaveLength(1);
    expect(depot.lignes[0]?.client).toBe("Client");
    expect(depot.lignes[0]?.montant).toBe(10);
  });

  it("shop/redact supprime toutes les lignes de la boutique", async () => {
    const depot = depotEnMemoire([ligneExemple("A"), ligneExemple("B")]);

    const compte = await traiterEffacementBoutique(depot, "boutique.myshopify.com");

    expect(compte).toBe(2);
    expect(depot.lignes).toHaveLength(0);
  });
});
