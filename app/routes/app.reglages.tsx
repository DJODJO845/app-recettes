import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";

import { authenticate, FORFAIT_MENSUEL } from "../shopify.server";
import { obtenirOuCreerBoutique, mettreAJourReglages } from "../lib/db/boutique.server";
import { MentionLegale } from "../lib/ui/MentionLegale";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";
import { CercleIcone } from "../lib/ui/CercleIcone";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);

  // `billing.check()` ne redirige jamais (contrairement à `billing.require()` dans
  // app.tsx) : on peut donc l'utiliser ici juste pour afficher où en est l'essai,
  // sans risquer de bloquer l'accès à la page si l'abonnement change entre-temps.
  const { appSubscriptions } = await billing.check({ plans: [FORFAIT_MENSUEL] });
  const abonnement = appSubscriptions[0] ?? null;

  return { boutique, abonnement };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const data = await request.formData();

  const emailRappelBrut = String(data.get("emailRappel") ?? "").trim();

  await mettreAJourReglages(session.shop, {
    typeActivite: data.get("typeActivite") as "COMMERCE" | "SERVICES" | "MIXTE",
    periodicite: data.get("periodicite") as "MENSUELLE" | "TRIMESTRIELLE",
    dateDebutActivite: new Date(String(data.get("dateDebutActivite"))),
    emailRappel: emailRappelBrut === "" ? null : emailRappelBrut,
  });

  return { succes: true };
};

const formateurDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export default function Reglages() {
  const { boutique, abonnement } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  let statutAbonnement: { enEssai: boolean; joursRestants: number; dateProchainePrelevement: Date } | null = null;
  if (abonnement) {
    const dateDebutEssai = new Date(abonnement.createdAt);
    const finEssai = new Date(dateDebutEssai);
    finEssai.setUTCDate(finEssai.getUTCDate() + abonnement.trialDays);
    const joursRestants = Math.ceil((finEssai.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    statutAbonnement = {
      enEssai: joursRestants > 0,
      joursRestants,
      dateProchainePrelevement: joursRestants > 0 ? finEssai : new Date(abonnement.currentPeriodEnd),
    };
  }

  useEffect(() => {
    if (fetcher.data?.succes) {
      shopify.toast.show("Réglages enregistrés");
    }
  }, [fetcher.data?.succes, shopify]);

  return (
    <s-page heading="Réglages">
      <s-section heading="Votre activité">
        <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
          <fetcher.Form method="post">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <CercleIcone type="business-entity" tone="info" fond="#E1F0FA" />
                <s-text color="subdued">
                  Ces réglages déterminent le plafond annuel applicable et le rythme de vos
                  échéances URSSAF.
                </s-text>
              </s-stack>

              <s-select name="typeActivite" label="Type d'activité" icon="business-entity">
                <s-option value="COMMERCE" defaultSelected={boutique.typeActivite === "COMMERCE"}>
                  Commerce
                </s-option>
                <s-option value="SERVICES" defaultSelected={boutique.typeActivite === "SERVICES"}>
                  Services
                </s-option>
                <s-option value="MIXTE" defaultSelected={boutique.typeActivite === "MIXTE"}>
                  Mixte
                </s-option>
              </s-select>

              <s-select name="periodicite" label="Périodicité de déclaration" icon="calendar">
                <s-option value="MENSUELLE" defaultSelected={boutique.periodicite === "MENSUELLE"}>
                  Mensuelle
                </s-option>
                <s-option value="TRIMESTRIELLE" defaultSelected={boutique.periodicite === "TRIMESTRIELLE"}>
                  Trimestrielle
                </s-option>
              </s-select>

              <s-date-field
                name="dateDebutActivite"
                label="Date de début d'activité"
                defaultValue={new Date(boutique.dateDebutActivite).toISOString().slice(0, 10)}
              />

              <s-email-field
                name="emailRappel"
                label="Email de rappel"
                defaultValue={boutique.emailRappel ?? ""}
                details="Laisser vide pour utiliser l'email de votre compte Shopify"
              />

              <s-button
                type="submit"
                variant="primary"
                icon="save"
                loading={fetcher.state !== "idle" ? true : undefined}
              >
                Enregistrer
              </s-button>
            </s-stack>
          </fetcher.Form>
        </s-box>
      </s-section>

      {statutAbonnement && (
        <s-section heading="Abonnement">
          <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
            <s-stack direction="block" gap="small-200">
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <CercleIcone
                  type="receipt-euro"
                  tone={statutAbonnement.enEssai ? "info" : "success"}
                  fond={statutAbonnement.enEssai ? "#E1F0FA" : "#E3F1EC"}
                />
                <s-badge tone={statutAbonnement.enEssai ? "info" : "success"}>
                  {statutAbonnement.enEssai ? "Essai gratuit" : "Abonnement actif"}
                </s-badge>
              </s-stack>
              <s-text color="subdued">
                {statutAbonnement.enEssai
                  ? `Encore ${statutAbonnement.joursRestants} jour(s) d'essai gratuit, jusqu'au ${formateurDate.format(statutAbonnement.dateProchainePrelevement)}. Premier prélèvement de 9,99 € ensuite.`
                  : `9,99 € / mois. Prochain prélèvement le ${formateurDate.format(statutAbonnement.dateProchainePrelevement)}.`}
              </s-text>
            </s-stack>
          </s-box>
        </s-section>
      )}

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
