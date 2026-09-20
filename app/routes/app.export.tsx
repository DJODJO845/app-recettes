import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { MentionLegale } from "../lib/ui/MentionLegale";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

/**
 * L'app tourne dans l'iframe imbriqué de Shopify. Les logs serveur montrent
 * des réponses 200 systématiques en moins d'une seconde à chaque tentative
 * (iframe caché, window.top.location, puis fetch+blob) : le serveur n'a
 * jamais été le problème. La vraie cause est une politique de sécurité de
 * Chrome qui bloque silencieusement (sans erreur) tout téléchargement dont
 * le contexte de navigation d'origine est un iframe cross-origin — exactement
 * notre cas, puisque Shopify embarque l'app dans son propre iframe. Cette
 * politique s'applique même à un blob créé en JS et cliqué via <a download>,
 * tant que ce code s'exécute dans l'iframe.
 *
 * La seule sortie fiable : ouvrir un tout nouvel onglet de plus haut niveau
 * (`window.open`, appelé de façon synchrone dans le clic pour ne pas être
 * bloqué comme pop-up) qui fait sa propre requête HTTP normale — un contexte
 * qui n'est plus du tout imbriqué dans un iframe, donc plus soumis à cette
 * restriction. Le navigateur y gère nativement le Content-Disposition
 * (téléchargement direct du CSV) et l'affichage HTML (version imprimable).
 */
function exporterCSV() {
  window.open("/app/export/csv", "_blank");
}

function exporterPDF() {
  window.open("/app/export/imprimer", "_blank");
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
