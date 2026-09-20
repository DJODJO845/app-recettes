import type { HeadersArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

/**
 * Ni le SDK Shopify ni React Router ne fixent de Cache-Control sur les pages
 * embarquées : en son absence, un intermédiaire (proxy, CDN) peut choisir de
 * mettre en cache une réponse 200 par défaut — un redéploiement confirmé
 * "live" côté Render peut alors continuer d'afficher l'ancienne version, même
 * en navigation privée. On l'interdit explicitement sur chaque route.
 */
export function headersNonMisEnCache(headersArgs: HeadersArgs): Headers {
  const reponse = boundary.headers(headersArgs);
  const fusion = new Headers(reponse);
  fusion.set("Cache-Control", "no-store");
  return fusion;
}
