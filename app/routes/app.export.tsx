import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { MentionLegale } from "../lib/ui/MentionLegale";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

/**
 * Récupère le fichier via fetch() (session déjà active, cookies inclus
 * automatiquement) plutôt que par un lien classique : une navigation directe
 * vers ces routes perd les paramètres d'intégration Shopify (host, embedded),
 * ce qui fait échouer l'authentification et affiche une page blanche.
 */
async function telechargerFichier(url: string, nomFichier: string) {
  const reponse = await fetch(url);
  const blob = await reponse.blob();
  const urlObjet = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = urlObjet;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(urlObjet);
}

async function ouvrirVersionImprimable(url: string) {
  const reponse = await fetch(url);
  const html = await reponse.text();
  const blob = new Blob([html], { type: "text/html" });
  const urlObjet = URL.createObjectURL(blob);
  window.open(urlObjet, "_blank");
}

export default function Export() {
  const [enCours, setEnCours] = useState<"csv" | "pdf" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const exporterCSV = async () => {
    setEnCours("csv");
    setErreur(null);
    try {
      await telechargerFichier("/app/export/csv", "livre-des-recettes.csv");
    } catch {
      setErreur("Échec de l'export CSV, réessayez.");
    } finally {
      setEnCours(null);
    }
  };

  const exporterPDF = async () => {
    setEnCours("pdf");
    setErreur(null);
    try {
      await ouvrirVersionImprimable("/app/export/imprimer");
    } catch {
      setErreur("Échec de l'ouverture de la version imprimable, réessayez.");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <s-page heading="Export">
      <s-section heading="Exporter votre livre des recettes">
        <s-paragraph>
          À conserver 10 ans de votre côté : Shopify supprime les données de l&apos;app
          48h après une désinstallation.
        </s-paragraph>
        {erreur && (
          <s-banner tone="critical">
            <s-paragraph>{erreur}</s-paragraph>
          </s-banner>
        )}
        <s-stack direction="inline" gap="base">
          <s-button
            onClick={exporterCSV}
            {...(enCours === "csv" ? { loading: true } : {})}
          >
            Export CSV
          </s-button>
          <s-button
            onClick={exporterPDF}
            {...(enCours === "pdf" ? { loading: true } : {})}
          >
            Version imprimable (PDF)
          </s-button>
        </s-stack>
        <s-paragraph>
          <s-text color="subdued">
            Pour le PDF : la version imprimable s&apos;ouvre dans un nouvel onglet,
            utilisez ensuite « Imprimer → Enregistrer au format PDF » de votre
            téléphone ou navigateur.
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
