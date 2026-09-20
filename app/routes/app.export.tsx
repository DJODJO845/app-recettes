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
  if (!reponse.ok) throw new Error(`Échec (${reponse.status})`);
  return reponse;
}

function exporterCSV(shopify: ReturnType<typeof useAppBridge>) {
  recupererAvecJeton(shopify, "/app/export/csv")
    .then(async (reponse) => {
      const blob = await reponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = blobUrl;
      lien.download = "livre-des-recettes.csv";
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    })
    .catch((erreur) => {
      console.error(erreur);
      shopify.toast.show("Erreur pendant le téléchargement du CSV", { isError: true });
    });
}

/**
 * window.open('', '_blank') doit être appelé de façon synchrone dans le clic
 * pour ne pas être bloqué comme pop-up ; on ouvre donc un onglet vide tout de
 * suite, puis on le remplit une fois le contenu récupéré avec le jeton.
 */
function exporterPDF(shopify: ReturnType<typeof useAppBridge>) {
  const fenetre = window.open("", "_blank");
  recupererAvecJeton(shopify, "/app/export/imprimer")
    .then(async (reponse) => {
      const html = await reponse.text();
      if (!fenetre) throw new Error("pop-up bloquée");
      fenetre.document.open();
      fenetre.document.write(html);
      fenetre.document.close();
    })
    .catch((erreur) => {
      console.error(erreur);
      fenetre?.close();
      shopify.toast.show("Erreur pendant l'ouverture de la version imprimable", { isError: true });
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
