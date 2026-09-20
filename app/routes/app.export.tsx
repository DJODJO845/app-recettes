import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { MentionLegale } from "../lib/ui/MentionLegale";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

/**
 * Cause racine (confirmée en lisant le SDK @shopify/shopify-app-react-router
 * installé) : avec `distribution: AppDistribution.AppStore`, authenticate.admin
 * exige un jeton de session (JWT) sur CHAQUE requête, sans repli sur le cookie
 * — voir authenticate/admin/authenticate.mjs, `getSessionTokenContext`. Une
 * requête document sans ce jeton passe par `ensureAppIsEmbeddedIfRequired`, qui
 * redirige silencieusement vers Shopify (redirect-to-shopify-or-app-root.mjs) —
 * c'est ce qui rendait iframe caché, window.top et fetch() nus systématiquement
 * vides ou faux (redirection suivie/avalée), quel que soit le mécanisme de
 * téléchargement essayé par-dessus.
 *
 * Le jeton ne peut être obtenu que depuis l'intérieur de l'iframe Shopify, via
 * App Bridge (`shopify.idToken()`). On l'attache en header Authorization : la
 * requête est alors traitée comme authentifiée immédiatement, sans passer par
 * la logique d'embarquement/redirection.
 */
async function recupererAvecJeton(shopify: ReturnType<typeof useAppBridge>, url: string) {
  const token = await shopify.idToken();
  const reponse = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!reponse.ok) {
    const corps = await reponse.text().catch(() => "");
    throw new Error(`HTTP ${reponse.status} — ${corps.slice(0, 120)}`);
  }
  return reponse;
}

/**
 * Le bouton doit donner un retour visible IMMÉDIATEMENT (avant même la
 * requête) : sans ça, un échec silencieux ressemble exactement à un clic qui
 * n'a rien déclenché, et on ne peut pas distinguer "le code ne tourne pas" de
 * "le code tourne mais échoue en silence" (alert() est probablement filtré
 * dans l'iframe Shopify — le toast App Bridge, lui, est rendu par Shopify
 * Admin lui-même, donc fiable).
 *
 * Le CSV se téléchargeait en fait bien (toast de succès reçu), mais aucun
 * fichier n'apparaissait : Chrome bloque silencieusement un téléchargement
 * (clic sur <a download>) déclenché depuis un iframe cross-origin — exactement
 * notre iframe Shopify. Le PDF, lui, restait bloqué sur "Préparation" sans
 * jamais aboutir : ouvrir un onglet vide AVANT de récupérer le contenu fait
 * perdre le focus à l'onglet de l'app, et les navigateurs mobiles mettent en
 * pause les onglets en arrière-plan — le jeton App Bridge (qui dépend d'un
 * postMessage avec Shopify Admin) ne pouvait donc jamais arriver.
 *
 * Fix pour les deux : tout préparer d'abord (jeton + contenu, pendant que
 * l'onglet de l'app a le focus), puis ouvrir un SEUL nouvel onglet une fois
 * le contenu prêt sous forme de blob — jamais de clic de téléchargement
 * dans l'iframe, jamais d'onglet vide qui traîne pendant l'attente.
 */
function exporterCSV(shopify: ReturnType<typeof useAppBridge>) {
  shopify.toast.show("Préparation du CSV…");
  recupererAvecJeton(shopify, "/app/export/csv")
    .then(async (reponse) => {
      const blob = await reponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      const fenetre = window.open(blobUrl, "_blank");
      if (!fenetre) throw new Error("pop-up bloquée par le navigateur");
      shopify.toast.show("CSV ouvert dans un nouvel onglet");
    })
    .catch((erreur) => {
      console.error(erreur);
      shopify.toast.show(`Erreur CSV : ${String(erreur?.message ?? erreur)}`, { isError: true, duration: 8000 });
    });
}

function exporterPDF(shopify: ReturnType<typeof useAppBridge>) {
  shopify.toast.show("Préparation de la version imprimable…");
  recupererAvecJeton(shopify, "/app/export/imprimer")
    .then(async (reponse) => {
      const html = await reponse.text();
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      const fenetre = window.open(blobUrl, "_blank");
      if (!fenetre) throw new Error("pop-up bloquée par le navigateur");
    })
    .catch((erreur) => {
      console.error(erreur);
      shopify.toast.show(`Erreur PDF : ${String(erreur?.message ?? erreur)}`, { isError: true, duration: 8000 });
    });
}

export default function Export() {
  const shopify = useAppBridge();

  return (
    <s-page heading="Export">
      <s-section heading="Exporter votre livre des recettes">
        <s-paragraph>
          À conserver 10 ans de votre côté : Shopify supprime les données de l&apos;app
          48h après une désinstallation.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button onClick={() => exporterCSV(shopify)}>Export CSV</s-button>
          <s-button onClick={() => exporterPDF(shopify)}>Version imprimable (PDF)</s-button>
        </s-stack>
        <s-paragraph>
          <s-text color="subdued">
            Pour le PDF : la version imprimable s&apos;ouvre dans un nouvel onglet —
            utilisez « Imprimer → Enregistrer au format PDF », puis fermez l&apos;onglet
            pour revenir à l&apos;app.
          </s-text>
        </s-paragraph>
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
