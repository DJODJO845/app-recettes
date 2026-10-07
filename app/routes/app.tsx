import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticateAdmin, FORFAIT_MENSUEL } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";

/**
 * Origine publique réelle (https://...) d'une requête passée par un proxy TLS-
 * terminating comme Render : request.url seul reflète le protocole vu par Node en
 * interne (http), pas celui utilisé par le navigateur — d'où X-Forwarded-Proto.
 */
function origineReelle(request: Request): string {
  const protocole = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const { host } = new URL(request.url);
  return protocole ? `${protocole}://${host}` : new URL(request.url).origin;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticateAdmin(request);
  await obtenirOuCreerBoutique(session.shop);

  // Facturation TEST par défaut (aucune carte requise), quel que soit
  // l'hébergeur — NODE_ENV n'est pas fiable pour ça : Render le met souvent à
  // "production" par défaut, ce qui aurait silencieusement demandé un vrai
  // moyen de paiement sur une boutique de démonstration (c'est exactement ce
  // qui vient de se produire). Passer en facturation réelle est désormais un
  // choix explicite : variable d'env SHOPIFY_BILLING_LIVE=true sur Render,
  // à activer seulement une fois prêt à facturer de vrais clients.
  const facturationReelle = process.env.SHOPIFY_BILLING_LIVE === "true";

  try {
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
          // Calculé depuis la requête elle-même plutôt que depuis SHOPIFY_APP_URL
          // (cf. commentaire historique), mais en respectant X-Forwarded-Proto :
          // Render termine le HTTPS en amont et transmet en HTTP en interne, donc
          // `new URL(request.url).origin` seul renvoie "http://..." — Shopify
          // renvoie alors le navigateur vers cette URL en clair après l'approbation,
          // bloquée par Android (ERR_CLEARTEXT_NOT_PERMITTED, vu en review le 6
          // octobre 2026 lors du test réel de l'écran d'approbation d'abonnement).
          returnUrl: `${origineReelle(request)}/app`,
        }),
    });
  } catch (erreur) {
    // billing.require()/billing.check() ne gèrent en interne qu'un 401 (token
    // invalide) ; un 403 ou une autre erreur de l'API GraphQL de Shopify (ex.
    // observé en review le 6 octobre 2026) remonte brute. On laisse passer les
    // Response (redirection vers la page d'approbation) et on ne convertit que
    // les vraies exceptions, pour ne jamais planter en 500 sur ce point d'entrée.
    if (erreur instanceof Response) {
      // Un Response ici est normalement une redirection légitime (3xx, vers la page
      // d'approbation de l'abonnement) — à ne pas journaliser comme une erreur. On ne
      // logue que les statuts d'erreur réels (ex. le 403 Shopify observé en review).
      if (erreur.status >= 400) {
        const corpsReponse = await erreur.clone().text().catch(() => "");
        console.error("Échec de billing.require() :", erreur.status, corpsReponse);
      }
      throw erreur;
    }
    throw new Response("Vérification de l'abonnement temporairement indisponible, merci de réessayer.", { status: 503 });
  }

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      {/* Pas de lien "Tableau de bord" explicite : le titre de l'app dans s-app-nav
          (élément natif Shopify) pointe déjà vers /app — un lien en plus ferait
          doublon dans le menu (signalé le 7 octobre 2026). */}
      <s-app-nav>
        <s-link href="/app/livre">Livre des recettes</s-link>
        <s-link href="/app/export">Export</s-link>
        <s-link href="/app/reglages">Réglages</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify a besoin que React Router intercepte certaines réponses levées, pour que
// leurs en-têtes soient inclus dans la réponse. boundary.error() ne sait afficher
// que les réponses qu'elle reconnaît comme siennes (redirections d'auth/facturation) ;
// pour tout le reste, elle relance l'erreur telle quelle — ce qui la fait sortir du
// contexte Shopify embarqué et atterrir sur la page générique de root.tsx (observé en
// review le 6 octobre 2026). Ce filet évite qu'un cas non reconnu par boundary.error()
// ne quitte l'écrin de l'app embarquée.
export function ErrorBoundary() {
  const error = useRouteError();
  try {
    return boundary.error(error);
  } catch {
    const message =
      error instanceof Response
        ? "Une erreur temporaire est survenue. Merci de réessayer."
        : "Une erreur inattendue s'est produite.";
    return (
      <s-page>
        <s-section heading="Oups, quelque chose s'est mal passé">
          <p>{message}</p>
        </s-section>
      </s-page>
    );
  }
}

export const headers: HeadersFunction = headersNonMisEnCache;
