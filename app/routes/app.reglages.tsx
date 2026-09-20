import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";

import { authenticate } from "../shopify.server";
import { obtenirOuCreerBoutique, mettreAJourReglages } from "../lib/db/boutique.server";
import { MentionLegale } from "../lib/ui/MentionLegale";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);
  return { boutique };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const data = await request.formData();

  await mettreAJourReglages(session.shop, {
    typeActivite: data.get("typeActivite") as "COMMERCE" | "SERVICES" | "MIXTE",
    periodicite: data.get("periodicite") as "MENSUELLE" | "TRIMESTRIELLE",
    dateDebutActivite: new Date(String(data.get("dateDebutActivite"))),
  });

  return { succes: true };
};

export default function Reglages() {
  const { boutique } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

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

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
