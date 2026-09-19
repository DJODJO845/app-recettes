import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import { calculerTotauxDashboard } from "../lib/db/totaux.server";
import { importerCommandesRecentes } from "../lib/shopify/importerCommandes.server";
import { plafondAnnuel } from "../lib/domain/reglementation";
import { BanniereExport } from "../lib/ui/BanniereExport";
import { MentionLegale } from "../lib/ui/MentionLegale";

const COULEUR_ALERTE: Record<string, string> = {
  ok: "#008060",
  avertissement: "#B98900",
  critique: "#D82C0D",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);

  try {
    await importerCommandesRecentes(admin, session.shop, boutique.dateDebutActivite);
  } catch (erreur) {
    // On n'empêche pas l'affichage du tableau de bord si l'import échoue (ex. souci
    // réseau ponctuel) : on montre les données déjà en base et on journalise l'erreur.
    console.error("Échec de l'import des commandes Shopify :", erreur);
  }

  const totaux = await calculerTotauxDashboard(
    session.shop,
    boutique.periodicite,
    boutique.typeActivite,
  );

  const plafond = plafondAnnuel(boutique.typeActivite.toLowerCase() as "commerce" | "services" | "mixte");
  const pourcentagePlafond = Math.min(100, Math.round((totaux.caAnnuelEncaisse / plafond) * 100));

  return { totaux, plafond, pourcentagePlafond };
};

const formateurEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default function Dashboard() {
  const { totaux, plafond, pourcentagePlafond } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Tableau de bord">
      <BanniereExport />

      <s-section heading={`CA encaissé — ${totaux.periode.label}`}>
        {totaux.caPeriodeCourante === 0 && (
          <s-banner tone="info">
            <s-paragraph>
              Aucun encaissement sur cette période. Une déclaration à 0 € reste
              obligatoire auprès de l&apos;URSSAF.
            </s-paragraph>
          </s-banner>
        )}
        <s-stack direction="block" gap="small">
          <s-heading>{formateurEUR.format(totaux.caPeriodeCourante)}</s-heading>
          <s-paragraph>Montant à déclarer à l&apos;URSSAF pour cette période.</s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="Jauge du plafond annuel">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            {formateurEUR.format(totaux.caAnnuelEncaisse)} encaissés depuis le 1er
            janvier, sur un plafond de {formateurEUR.format(plafond)} ({pourcentagePlafond}
            %).
          </s-paragraph>
          <s-box padding="none" borderWidth="base" borderRadius="base" background="subdued">
            <div style={{ height: "12px", width: "100%", background: "#E1E3E5", borderRadius: "6px" }}>
              <div
                style={{
                  height: "12px",
                  width: `${pourcentagePlafond}%`,
                  background: COULEUR_ALERTE[totaux.niveauAlerte],
                  borderRadius: "6px",
                }}
              />
            </div>
          </s-box>
          {totaux.niveauAlerte === "avertissement" && (
            <s-banner tone="warning">
              <s-paragraph>
                Vous approchez du plafond annuel (80 %). Pensez à anticiper la suite.
              </s-paragraph>
            </s-banner>
          )}
          {totaux.niveauAlerte === "critique" && (
            <s-banner tone="critical">
              <s-paragraph>
                Attention, vous dépassez 95 % du plafond annuel. Rapprochez-vous d&apos;un
                expert-comptable ou de l&apos;URSSAF rapidement.
              </s-paragraph>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
