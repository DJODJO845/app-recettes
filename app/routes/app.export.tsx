import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { MentionLegale } from "../lib/ui/MentionLegale";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const host = new URL(request.url).searchParams.get("host") ?? "";
  return { shop: session.shop, host };
};

/**
 * Historique des causes déjà éliminées (voir commits précédents) :
 * - distribution AppStore exige un jeton de session sur chaque requête (pas
 *   de repli cookie) ;
 * - fetch()+blob() récupère bien le contenu (jeton en header Authorization
 *   fonctionne), mais Chrome bloque silencieusement toute navigation vers un
 *   blob: (ou tout clic <a download>) initiée depuis un iframe cross-origin —
 *   notre iframe Shopify — que ce soit un clic ou un window.open(blobUrl).
 *
 * Le SDK accepte aussi le jeton en paramètre d'URL (`id_token`), en plus de
 * `shop`, `host` et `embedded=1` — c'est exactement ce que fait sa propre
 * "bounce page" interne. En construisant cette URL et en l'ouvrant
 * directement (pas de blob, pas de fetch client), le nouvel onglet fait une
 * VRAIE requête HTTP normale vers le serveur : plus aucune restriction
 * d'iframe ne s'applique, le navigateur gère le téléchargement/l'affichage
 * nativement comme pour n'importe quel lien.
 */
async function urlAutorisee(
  shopify: ReturnType<typeof useAppBridge>,
  shop: string,
  host: string,
  chemin: string,
) {
  const token = await shopify.idToken();
  const params = new URLSearchParams({ shop, host, embedded: "1", id_token: token });
  return `${chemin}?${params.toString()}`;
}

function exporterCSV(shopify: ReturnType<typeof useAppBridge>, shop: string, host: string) {
  shopify.toast.show("Préparation du CSV…");
  urlAutorisee(shopify, shop, host, "/app/export/csv")
    .then((url) => {
      const fenetre = window.open(url, "_blank");
      if (!fenetre) throw new Error("pop-up bloquée par le navigateur");
    })
    .catch((erreur) => {
      console.error(erreur);
      shopify.toast.show(`Erreur CSV : ${String(erreur?.message ?? erreur)}`, { isError: true, duration: 8000 });
    });
}

function exporterPDF(shopify: ReturnType<typeof useAppBridge>, shop: string, host: string) {
  shopify.toast.show("Préparation de la version imprimable…");
  urlAutorisee(shopify, shop, host, "/app/export/imprimer")
    .then((url) => {
      const fenetre = window.open(url, "_blank");
      if (!fenetre) throw new Error("pop-up bloquée par le navigateur");
    })
    .catch((erreur) => {
      console.error(erreur);
      shopify.toast.show(`Erreur PDF : ${String(erreur?.message ?? erreur)}`, { isError: true, duration: 8000 });
    });
}

export default function Export() {
  const { shop, host } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  return (
    <s-page heading="Export">
      <s-section heading="Exporter votre livre des recettes">
        <s-paragraph>
          À conserver 10 ans de votre côté : Shopify supprime les données de l&apos;app
          48h après une désinstallation.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button onClick={() => exporterCSV(shopify, shop, host)}>Export CSV</s-button>
          <s-button onClick={() => exporterPDF(shopify, shop, host)}>Version imprimable (PDF)</s-button>
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
