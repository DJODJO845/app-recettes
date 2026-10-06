import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Même précaution que app.tsx : authenticate.admin() lève un Response pour les
  // redirections OAuth normales (à laisser remonter), mais peut aussi lever une
  // exception brute (ex. host/shop malformé) — cette route gère tout /auth/*, y
  // compris le callback juste après l'approbation sur Shopify, et n'a pas d'écran
  // propre : sans ce filet, l'erreur tombait sur la page générique hors contexte
  // Shopify (cf. retour de review du 6 octobre 2026 et reproduction manuelle).
  try {
    await authenticate.admin(request);
  } catch (erreur) {
    if (erreur instanceof Response) throw erreur;
    throw new Response("Paramètres de requête invalides", { status: 400 });
  }

  return null;
};
