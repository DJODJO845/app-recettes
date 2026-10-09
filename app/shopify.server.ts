import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Un seul palier : le périmètre de l'app (calcul + export du livre des
// recettes) ne justifie pas de fonctionnalités réservées à un plan
// supérieur — voir décision Phase 5 (9,99 €/mois, essai 7 jours).
export const FORFAIT_MENSUEL = "Forfait mensuel";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    [FORFAIT_MENSUEL]: {
      trialDays: 7,
      lineItems: [
        {
          amount: 9.99,
          currencyCode: "EUR",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  // OBLIGATOIRE pour les apps publiques créées après le 1er avril 2026 (notre cas) :
  // sans ce flag, Shopify demande un token offline classique (non expirant), que
  // l'API Admin rejette désormais silencieusement — 403 vide ("GraphQL Client: ")
  // sur TOUS les appels GraphQL, vu en review le 6 octobre 2026 après l'avoir
  // désactivé par erreur pour contourner un autre bug (voir authenticateWebhook
  // ci-dessous pour le vrai correctif de ce second bug, sans toucher à ce flag).
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

/**
 * À utiliser à la place de authenticate.admin(request) dans TOUTES les routes /app/*.
 * authenticate.admin() lève un Response pour les redirections légitimes (OAuth,
 * facturation) — à laisser remonter tel quel — mais peut aussi lever une exception
 * brute (host/shop malformé, erreur réseau pendant l'échange de token...). Sans ce
 * filet, une telle exception sort du contexte Shopify embarqué et atterrit sur la
 * page générique hors cadre de root.tsx (plusieurs cas vus en review le 6 octobre
 * 2026, sur des routes différentes à chaque fois — d'où ce point d'entrée unique
 * plutôt qu'un try/catch dupliqué dans chaque fichier de route).
 */
export async function authenticateAdmin(request: Request) {
  try {
    return await authenticate.admin(request);
  } catch (erreur) {
    if (erreur instanceof Response) throw erreur;
    throw new Response("Paramètres de requête invalides", { status: 400 });
  }
}

/**
 * À utiliser à la place de authenticate.webhook(request) dans toutes les routes
 * /webhooks/*. Avec expiringOfflineAccessTokens actif (requis, cf. ci-dessus),
 * authenticate.webhook() tente de rafraîchir le token offline dès qu'il approche de
 * l'expiration — y compris pour app/uninstalled et shop/redact, qui arrivent
 * justement quand Shopify vient de le révoquer. Ce rafraîchissement échoue alors
 * côté Shopify, et la librairie relance l'erreur AVANT que authenticate.webhook()
 * ne retourne, donc avant que notre handler ne s'exécute (500 systématique, vu en
 * review le 6 octobre 2026).
 *
 * À ce stade de authenticate.webhook(), le HMAC a déjà été validé (sinon la
 * librairie aurait levé un Response 401/400 plus tôt) : la requête est donc
 * authentiquement de Shopify, même si on ne peut pas récupérer la session/le
 * payload complet. On retombe sur shop/topic lus directement depuis les en-têtes
 * HMAC-signés (toujours disponibles), suffisants pour les handlers qui n'ont besoin
 * que du domaine de la boutique (app/uninstalled, shop/redact).
 */
export async function authenticateWebhook(request: Request) {
  try {
    return await authenticate.webhook(request);
  } catch (erreur) {
    if (erreur instanceof Response) throw erreur;
    const shop = request.headers.get("X-Shopify-Shop-Domain") ?? "";
    const topic = request.headers.get("X-Shopify-Topic") ?? "";
    console.error(`authenticate.webhook() a échoué (token offline) pour ${topic} / ${shop} :`, erreur);
    return {
      shop,
      topic,
      session: undefined,
      payload: null,
      admin: undefined,
      apiVersion: apiVersion as unknown as Awaited<ReturnType<typeof authenticate.webhook>>["apiVersion"],
      webhookId: request.headers.get("X-Shopify-Webhook-Id") ?? "",
      webhookType: undefined,
    } as unknown as Awaited<ReturnType<typeof authenticate.webhook>>;
  }
}
