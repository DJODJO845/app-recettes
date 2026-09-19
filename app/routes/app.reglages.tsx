import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";

import { authenticate } from "../shopify.server";
import { obtenirOuCreerBoutique, mettreAJourReglages } from "../lib/db/boutique.server";
import { MentionLegale } from "../lib/ui/MentionLegale";

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
        <fetcher.Form method="post">
          <s-stack direction="block" gap="base">
            <label>
              Type d&apos;activité
              <select name="typeActivite" defaultValue={boutique.typeActivite}>
                <option value="COMMERCE">Vente de marchandises (commerce)</option>
                <option value="SERVICES">Prestations de services</option>
                <option value="MIXTE">Mixte (commerce + services)</option>
              </select>
            </label>

            <label>
              Périodicité de déclaration
              <select name="periodicite" defaultValue={boutique.periodicite}>
                <option value="MENSUELLE">Mensuelle</option>
                <option value="TRIMESTRIELLE">Trimestrielle</option>
              </select>
            </label>

            <label>
              Date de début d&apos;activité
              <input
                type="date"
                name="dateDebutActivite"
                defaultValue={new Date(boutique.dateDebutActivite).toISOString().slice(0, 10)}
              />
            </label>

            <s-button type="submit" loading={fetcher.state !== "idle" ? true : undefined}>
              Enregistrer
            </s-button>
          </s-stack>
        </fetcher.Form>
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
