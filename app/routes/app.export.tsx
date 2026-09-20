import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { MentionLegale } from "../lib/ui/MentionLegale";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

/**
 * L'app tourne dans l'iframe imbriqué de Shopify. Les techniques basées sur
 * une navigation (iframe caché, window.top.location) sont bloquées
 * silencieusement par le navigateur dans ce contexte : les logs serveur
 * confirment des réponses 200 en quelques ms à chaque tentative, donc le
 * problème n'a jamais été côté serveur — c'est la navigation imbriquée qui
 * échoue à se traduire en téléchargement ou en page visible.
 *
 * On utilise donc `fetch()` (même contexte authentifié que le reste de
 * l'app, qui fonctionne déjà pour le Dashboard/Livre) pour récupérer le
 * contenu en JS, puis on le remet au navigateur via un blob téléchargeable
 * ou un onglet pré-ouvert — sans jamais dépendre d'une navigation d'iframe.
 */
async function telechargerViaBlob(url: string, nomFichier: string) {
  const reponse = await fetch(url, { credentials: "same-origin" });
  if (!reponse.ok) throw new Error(`Échec du téléchargement (${reponse.status})`);
  const blob = await reponse.blob();
  const blobUrl = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = blobUrl;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

function exporterCSV() {
  telechargerViaBlob("/app/export/csv", "livre-des-recettes.csv").catch((erreur) => {
    console.error(erreur);
    alert("Erreur pendant le téléchargement du CSV. Réessayez.");
  });
}

/**
 * window.open('', '_blank') doit être appelé de façon SYNCHRONE dans le
 * gestionnaire de clic pour ne pas être bloqué par le bloqueur de pop-up
 * (un appel après un `await fetch` serait considéré comme hors du geste
 * utilisateur). On ouvre donc un onglet vide tout de suite, puis on le
 * remplit une fois le contenu récupéré.
 */
function exporterPDF() {
  const fenetre = window.open("", "_blank");
  fetch("/app/export/imprimer", { credentials: "same-origin" })
    .then(async (reponse) => {
      if (!reponse.ok) throw new Error(`Échec (${reponse.status})`);
      const html = await reponse.text();
      if (!fenetre) throw new Error("pop-up bloquée");
      fenetre.document.open();
      fenetre.document.write(html);
      fenetre.document.close();
    })
    .catch((erreur) => {
      console.error(erreur);
      fenetre?.close();
      alert(
        "Erreur pendant l'ouverture de la version imprimable. Vérifiez que les pop-ups sont autorisées pour ce site, puis réessayez.",
      );
    });
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
