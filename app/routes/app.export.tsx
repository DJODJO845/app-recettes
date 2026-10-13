import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticateAdmin } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import { decalagePeriodeDepuisParam, periodeDecalee } from "../lib/domain/periode";
import { MentionLegale } from "../lib/ui/MentionLegale";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";
import { CercleIcone } from "../lib/ui/CercleIcone";
import { libelleDernierExport } from "../lib/ui/dateRelative";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request);
  // Le paramètre `host` de l'URL ne survit pas toujours à la navigation
  // React Router entre les pages de l'app (confirmé par les logs Render :
  // `host=` vide sur /app/export/csv). Plutôt que d'en dépendre, on le
  // recalcule nous-mêmes : c'est juste base64("{shop}/admin"), le format
  // que Shopify lui-même utilise (cf. sanitizeHost dans @shopify/shopify-api).
  const host = Buffer.from(`${session.shop}/admin`).toString("base64");
  const boutique = await obtenirOuCreerBoutique(session.shop);

  const url = new URL(request.url);
  const decalagePeriode = decalagePeriodeDepuisParam(url.searchParams.get("periode"));
  const periodeLabel = periodeDecalee(boutique.periodicite, decalagePeriode).label;

  return {
    shop: session.shop,
    host,
    derniereExportation: boutique.derniereExportation,
    decalagePeriode,
    periodeLabel,
  };
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
  // `chemin` peut déjà porter son propre paramètre (ex. "...declaration?periode=-1") :
  // un "?" supplémentaire casserait le parsing (shop/host/id_token finiraient noyés
  // dans la valeur du premier paramètre). D'où ce choix du bon séparateur.
  const separateur = chemin.includes("?") ? "&" : "?";
  return `${chemin}${separateur}${params.toString()}`;
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

function voirDeclaration(shopify: ReturnType<typeof useAppBridge>, shop: string, host: string, decalagePeriode: number) {
  shopify.toast.show("Préparation de la déclaration…");
  urlAutorisee(shopify, shop, host, `/app/export/declaration?periode=${decalagePeriode}`)
    .then((url) => {
      const fenetre = window.open(url, "_blank");
      if (!fenetre) throw new Error("pop-up bloquée par le navigateur");
    })
    .catch((erreur) => {
      console.error(erreur);
      shopify.toast.show(`Erreur déclaration : ${String(erreur?.message ?? erreur)}`, { isError: true, duration: 8000 });
    });
}

export default function Export() {
  const { shop, host, derniereExportation, decalagePeriode, periodeLabel } = useLoaderData<typeof loader>();
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
        <s-stack direction="block" gap="base">
          <s-text color="subdued">
            {libelleDernierExport(derniereExportation ? new Date(derniereExportation) : null)}
          </s-text>
          <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <CercleIcone type="export" tone="success" fond="var(--tinte-ok)" />
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
                <CercleIcone type="print" tone="info" fond="var(--tinte-info)" />
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
        </s-stack>
      </s-section>

      <s-section heading="Déclaration de la période">
        <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="small-300" alignItems="center">
              <CercleIcone type="calendar-check" tone="info" fond="var(--tinte-info)" />
              <s-text type="strong">Fiche de déclaration</s-text>
            </s-stack>
            <s-text color="subdued">
              Une page avec uniquement le montant à recopier dans votre
              déclaration URSSAF pour une période donnée — plus rapide à
              consulter que le livre complet au moment de déclarer.
            </s-text>
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-link href={`/app/export?periode=${decalagePeriode - 1}`}>← Période précédente</s-link>
              <s-text type="strong">{periodeLabel}</s-text>
              {decalagePeriode < 0 ? (
                <s-link href={`/app/export?periode=${decalagePeriode + 1}`}>Période suivante →</s-link>
              ) : (
                <s-text color="subdued">Période suivante →</s-text>
              )}
            </s-stack>
            <s-button
              onClick={() => voirDeclaration(shopify, shop, host, decalagePeriode)}
              icon="calendar-check"
              variant="primary"
            >
              Voir la déclaration
            </s-button>
          </s-stack>
        </s-box>
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
