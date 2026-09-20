import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { MentionLegale } from "../lib/ui/MentionLegale";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

/**
 * Navigation directe et synchrone, déclenchée dans le même tick que le clic
 * (pas de fetch()/await avant) : certains navigateurs mobiles annulent
 * silencieusement une action de téléchargement/ouverture déclenchée après un
 * appel asynchrone, car elle n'est plus rattachée au geste utilisateur.
 * Le CSV a un en-tête Content-Disposition: attachment, donc cette navigation
 * déclenche un téléchargement sans quitter la page actuelle.
 */
function exporterCSV() {
  window.location.href = "/app/export/csv";
}

function exporterPDF() {
  window.location.href = "/app/export/imprimer";
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
