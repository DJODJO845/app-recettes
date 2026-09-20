import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { MentionLegale } from "../lib/ui/MentionLegale";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

/**
 * L'app tourne dans l'iframe intégré de Shopify : `window.location.href` ne
 * navigue que cet iframe, où un téléchargement (Content-Disposition:
 * attachment) est silencieusement ignoré par le navigateur (pas d'erreur,
 * juste rien qui se passe). On déclenche le téléchargement via un iframe
 * caché dédié — technique standard qui fonctionne même imbriquée dans
 * l'iframe Shopify, sans jamais faire naviguer notre propre page.
 */
function exporterCSV() {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = "/app/export/csv";
  document.body.appendChild(iframe);
  setTimeout(() => iframe.remove(), 10000);
}

/**
 * Pour la version imprimable, on veut au contraire sortir complètement de
 * l'iframe Shopify (impossible d'imprimer proprement une page à l'intérieur
 * d'un iframe imbriqué). `window.top.location.href` est l'exception que les
 * navigateurs autorisent pour naviguer une fenêtre de plus haut niveau même
 * si elle est cross-origin (on peut l'écrire, pas la lire).
 */
function exporterPDF() {
  window.top!.location.href = window.location.origin + "/app/export/imprimer";
}

export default function Export() {
  return (
    <s-page heading="Export">
      <s-section heading="Exporter votre livre des recettes">
        <s-paragraph>
          À conserver 10 ans de votre côté : Shopify supprime les données de l&apos;app
          48h après une désinstallation.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button onClick={exporterCSV}>Export CSV</s-button>
          <s-button onClick={exporterPDF}>Version imprimable (PDF)</s-button>
        </s-stack>
        <s-paragraph>
          <s-text color="subdued">
            Pour le PDF : la version imprimable remplace temporairement l&apos;app —
            utilisez « Imprimer → Enregistrer au format PDF », puis le bouton
            retour de votre téléphone pour revenir à l&apos;app.
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
