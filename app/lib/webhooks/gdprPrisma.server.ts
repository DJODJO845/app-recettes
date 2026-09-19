import { executerAvecContexteBoutique } from "../db/rls.server";
import { listerLignesParClientId } from "../db/lignesLivre.server";
import type { DepotLignesLivre } from "./gdpr";

/** Implémentation Prisma/Supabase de `DepotLignesLivre`, utilisée par les vraies routes webhooks. */
export const depotPrisma: DepotLignesLivre = {
  async listerParClientId(shopDomain, clientId) {
    return listerLignesParClientId(shopDomain, clientId);
  },

  async anonymiserClientId(shopDomain, clientId) {
    const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
      tx.ligneLivre.updateMany({
        where: { shopDomain, clientId },
        data: { client: "Client" },
      }),
    );
    return resultat.count;
  },

  async supprimerToutesLesLignes(shopDomain) {
    const resultat = await executerAvecContexteBoutique(shopDomain, (tx) =>
      tx.ligneLivre.deleteMany({ where: { shopDomain } }),
    );
    return resultat.count;
  },
};
