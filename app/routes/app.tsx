import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await obtenirOuCreerBoutique(session.shop);

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
