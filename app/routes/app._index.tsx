import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import { calculerTotauxDashboard } from "../lib/db/totaux.server";
import { importerCommandesRecentes } from "../lib/shopify/importerCommandes.server";
import { plafondAnnuel, type NiveauAlertePlafond } from "../lib/domain/reglementation";
import { BanniereExport } from "../lib/ui/BanniereExport";
import { MentionLegale } from "../lib/ui/MentionLegale";

const COULEUR_ALERTE: Record<NiveauAlertePlafond, string> = {
  ok: "#008060",
  avertissement: "#B98900",
  critique: "#D82C0D",
};

const BADGE_ALERTE = {
  ok: { tone: "success", label: "Sous contrôle", icone: "check-circle-filled" },
  avertissement: { tone: "warning", label: "À surveiller", icone: "alert-triangle" },
  critique: { tone: "critical", label: "Seuil critique", icone: "alert-diamond" },
} as const satisfies Record<NiveauAlertePlafond, { tone: "success" | "warning" | "critical"; label: string; icone: string }>;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);

  try {
    await importerCommandesRecentes(admin, session.shop, boutique.dateDebutActivite);
  } catch (erreur) {
    // On n'empêche pas l'affichage du tableau de bord si l'import échoue (ex. souci
    // réseau ponctuel) : on montre les données déjà en base et on journalise l'erreur.
    // On extrait explicitement graphQLErrors : les logs par défaut le tronquent en
    // "[Array]" (limite de profondeur de console.error), ce qui masque le vrai message.
    const graphQLErrors = (erreur as { graphQLErrors?: unknown })?.graphQLErrors;
    console.error(
      "Échec de l'import des commandes Shopify :",
      erreur instanceof Error ? erreur.message : erreur,
      graphQLErrors ? JSON.stringify(graphQLErrors) : "",
    );
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
  const badge = BADGE_ALERTE[totaux.niveauAlerte];

  return (
    <s-page heading="Tableau de bord">
      <BanniereExport />

      {totaux.caPeriodeCourante === 0 && (
        <s-banner tone="info">
          <s-paragraph>
            Aucun encaissement sur cette période. Une déclaration à 0 € reste
            obligatoire auprès de l&apos;URSSAF.
          </s-paragraph>
        </s-banner>
      )}

      <s-section>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
            <s-stack direction="block" gap="small-200">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-icon type="cash-euro" tone="success" />
                <s-text type="strong" color="subdued">CA encaissé — {totaux.periode.label}</s-text>
              </s-stack>
              <s-heading>{formateurEUR.format(totaux.caPeriodeCourante)}</s-heading>
              <s-text color="subdued">Montant à déclarer à l&apos;URSSAF pour cette période</s-text>
            </s-stack>
          </s-box>

          <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
            <s-stack direction="block" gap="small-200">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-icon type="gauge" tone={badge.tone} />
                <s-text type="strong" color="subdued">Plafond annuel</s-text>
              </s-stack>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-heading>{pourcentagePlafond}%</s-heading>
                <s-badge tone={badge.tone} icon={badge.icone}>{badge.label}</s-badge>
              </s-stack>
              <s-text color="subdued">
                {formateurEUR.format(totaux.caAnnuelEncaisse)} sur {formateurEUR.format(plafond)}
              </s-text>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Jauge du plafond annuel">
        <s-stack direction="block" gap="base">
          <div style={{ position: "relative", height: "16px", width: "100%", background: "#E1E3E5", borderRadius: "8px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pourcentagePlafond}%`,
                background: COULEUR_ALERTE[totaux.niveauAlerte],
                borderRadius: "8px",
                transition: "width 0.3s ease",
              }}
            />
            <div style={{ position: "absolute", left: "80%", top: 0, bottom: 0, width: "2px", background: "rgba(0,0,0,0.25)" }} />
            <div style={{ position: "absolute", left: "95%", top: 0, bottom: 0, width: "2px", background: "rgba(0,0,0,0.25)" }} />
          </div>
          <s-stack direction="inline" justifyContent="space-between">
            <s-text color="subdued">0 €</s-text>
            <s-text color="subdued">Seuils d&apos;alerte : 80 % et 95 %</s-text>
            <s-text color="subdued">{formateurEUR.format(plafond)}</s-text>
          </s-stack>
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
