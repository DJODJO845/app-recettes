import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { MentionLegale } from "../lib/ui/MentionLegale";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Export() {
  return (
    <s-page heading="Export">
      <s-section heading="Exporter votre livre des recettes">
        <s-paragraph>
          À conserver 10 ans de votre côté : Shopify supprime les données de l&apos;app
          48h après une désinstallation.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          {/*
            target="_top" force une vraie navigation de page (hors du routeur
            React Router côté client) : sans ça, le lien était intercepté et
            transformé en appel `/app/export/csv.data`, qui ne renvoie jamais
            le fichier lui-même.
          */}
          <s-button href="/app/export/csv" target="_top">
            Export CSV
          </s-button>
          <s-button href="/app/export/imprimer" target="_top">
            Version imprimable (PDF)
          </s-button>
        </s-stack>
        <s-paragraph>
          <s-text color="subdued">
            Pour le PDF : utilisez ensuite « Imprimer → Enregistrer au format PDF »
            de votre téléphone ou navigateur, puis revenez en arrière pour retrouver
            l&apos;app.
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
