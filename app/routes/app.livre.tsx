import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { listerLignes } from "../lib/db/lignesLivre.server";
import { MentionLegale } from "../lib/ui/MentionLegale";
import type { NatureLigneLivre } from "../lib/domain/types";

const LIBELLES_NATURE: Record<NatureLigneLivre, string> = {
  vente: "Vente",
  vente_carte_cadeau: "Vente de carte cadeau",
  reglement_carte_cadeau: "Règlement par carte cadeau",
  remboursement: "Remboursement",
};

const formateurEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const formateurDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const debutParam = url.searchParams.get("debut");
  const finParam = url.searchParams.get("fin");

  const periode =
    debutParam && finParam
      ? { debut: new Date(debutParam), fin: new Date(`${finParam}T23:59:59`) }
      : undefined;

  const lignes = await listerLignes(session.shop, periode);

  return { lignes };
};

export default function LivreDesRecettes() {
  const { lignes } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <s-page heading="Livre des recettes">
      <s-section heading="Filtrer par période">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const debut = String(data.get("debut") ?? "");
            const fin = String(data.get("fin") ?? "");
            if (debut && fin) setSearchParams({ debut, fin });
          }}
        >
          <s-stack direction="inline" gap="base">
            <input type="date" name="debut" defaultValue={searchParams.get("debut") ?? ""} />
            <input type="date" name="fin" defaultValue={searchParams.get("fin") ?? ""} />
            <s-button type="submit">Filtrer</s-button>
          </s-stack>
        </form>
      </s-section>

      <s-section heading={`${lignes.length} ligne(s)`}>
        {lignes.length === 0 ? (
          <s-paragraph>Aucune ligne sur cette période.</s-paragraph>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #E1E3E5" }}>
                <th>Date</th>
                <th>Référence</th>
                <th>Client</th>
                <th>Nature</th>
                <th>Mode de règlement</th>
                <th>Canal</th>
                <th style={{ textAlign: "right" }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr
                  key={ligne.id}
                  style={{
                    borderBottom: "1px solid #F1F1F1",
                    color: ligne.montant < 0 ? "#D82C0D" : undefined,
                  }}
                >
                  <td>{formateurDate.format(new Date(ligne.date))}</td>
                  <td>{ligne.reference}</td>
                  <td>{ligne.client}</td>
                  <td>
                    {LIBELLES_NATURE[ligne.nature]}
                    {!ligne.compteDansCA && " (déjà comptée à l'achat de la carte)"}
                  </td>
                  <td>{ligne.modeReglement}</td>
                  <td>{ligne.canal}</td>
                  <td style={{ textAlign: "right" }}>{formateurEUR.format(ligne.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
