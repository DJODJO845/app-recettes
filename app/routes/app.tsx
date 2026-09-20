import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate, FORFAIT_MENSUEL } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  await obtenirOuCreerBoutique(session.shop);

  // Facturation TEST par défaut (aucune carte requise), quel que soit
  // l'hébergeur — NODE_ENV n'est pas fiable pour ça : Render le met souvent à
  // "production" par défaut, ce qui aurait silencieusement demandé un vrai
  // moyen de paiement sur une boutique de démonstration (c'est exactement ce
  // qui vient de se produire). Passer en facturation réelle est désormais un
  // choix explicite : variable d'env SHOPIFY_BILLING_LIVE=true sur Render,
  // à activer seulement une fois prêt à facturer de vrais clients.
  const facturationReelle = process.env.SHOPIFY_BILLING_LIVE === "true";

  // Bloque l'accès tant que l'abonnement (ou l'essai de 7 jours) n'est pas
  // actif — billing.request() lève une redirection vers la page de
  // confirmation Shopify, donc rien après cet appel ne s'exécute si l'essai
  // n'a pas encore été accepté.
  await billing.require({
    plans: [FORFAIT_MENSUEL],
    isTest: !facturationReelle,
    onFailure: async () =>
      billing.request({
        plan: FORFAIT_MENSUEL,
        isTest: !facturationReelle,
        // Calculé depuis la requête elle-même plutôt que depuis
        // SHOPIFY_APP_URL : si cette variable est absente ou mal configurée
        // sur l'hébergeur, Shopify reçoit une returnUrl invalide et affiche
        // une erreur générique sur la page d'approbation de l'abonnement.
        returnUrl: `${new URL(request.url).origin}/app`,
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

export const headers: HeadersFunction = headersNonMisEnCache;
