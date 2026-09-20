import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate, FORFAIT_MENSUEL } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  await obtenirOuCreerBoutique(session.shop);

  // Bloque l'accès tant que l'abonnement (ou l'essai de 7 jours) n'est pas
  // actif — billing.request() lève une redirection vers la page de
  // confirmation Shopify, donc rien après cet appel ne s'exécute si l'essai
  // n'a pas encore été accepté.
  await billing.require({
    plans: [FORFAIT_MENSUEL],
    isTest: process.env.NODE_ENV !== "production",
    onFailure: async () =>
      billing.request({
        plan: FORFAIT_MENSUEL,
        isTest: process.env.NODE_ENV !== "production",
        returnUrl: `${process.env.SHOPIFY_APP_URL}/app`,
      }),
  });

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Tableau de bord</s-link>
        <s-link href="/app/livre">Livre des recettes</s-link>
        <s-link href="/app/export">Export</s-link>
        <s-link href="/app/reglages">Réglages</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify a besoin que React Router intercepte certaines réponses levées, pour que
// leurs en-têtes soient inclus dans la réponse.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
