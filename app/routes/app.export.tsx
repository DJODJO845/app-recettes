import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { MentionLegale } from "../lib/ui/MentionLegale";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  // Le paramètre `host` de l'URL ne survit pas toujours à la navigation
  // React Router entre les pages de l'app (confirmé par les logs Render :
  // `host=` vide sur /app/export/csv). Plutôt que d'en dépendre, on le
  // recalcule nous-mêmes : c'est juste base64("{shop}/admin"), le format
  // que Shopify lui-même utilise (cf. sanitizeHost dans @shopify/shopify-api).
  const host = Buffer.from(`${session.shop}/admin`).toString("base64");
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

function CercleIcone({
  type,
  tone,
  fond,
}: {
  type: "export" | "print";
  tone: "success" | "info";
  fond: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background: fond,
        flexShrink: 0,
      }}
    >
      <s-icon type={type} tone={tone} />
    </div>
  );
}

export default function Export() {
  const { shop, host } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  return (
    <s-page heading="Export">
      <s-banner tone="info">
        <s-paragraph>
          À conserver 10 ans de votre côté : Shopify supprime les données de l&apos;app
          48h après une désinstallation.
        </s-paragraph>
      </s-banner>

      <s-section heading="Exporter votre livre des recettes">
        <s-grid gridTemplateColumns="@container (inline-size < 28rem) 1fr, 1fr 1fr" gap="base">
          <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <CercleIcone type="export" tone="success" fond="#E3F1EC" />
                <s-text type="strong">Export CSV</s-text>
              </s-stack>
              <s-text color="subdued">
                Toutes les lignes du livre, au format tableur — pour votre
                comptable ou votre propre archivage.
              </s-text>
              <s-button onClick={() => exporterCSV(shopify, shop, host)} icon="export" variant="primary">
                Télécharger le CSV
              </s-button>
            </s-stack>
          </s-box>

          <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <CercleIcone type="print" tone="info" fond="#E1F0FA" />
                <s-text type="strong">Version imprimable</s-text>
              </s-stack>
              <s-text color="subdued">
                S&apos;ouvre dans un nouvel onglet, prête à imprimer ou à
                enregistrer en PDF.
              </s-text>
              <s-button onClick={() => exporterPDF(shopify, shop, host)} icon="print" variant="primary">
                Ouvrir la version imprimable
              </s-button>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
