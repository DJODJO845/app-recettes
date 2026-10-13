import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticateAdmin } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import { obtenirMeilleuresVentes } from "../lib/db/articlesVendus.server";
import { decalagePeriodeDepuisParam, periodeDecalee } from "../lib/domain/periode";
import { MentionLegale } from "../lib/ui/MentionLegale";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";
import { formateurEUR } from "../lib/ui/formateurs";

const NOMBRE_MEILLEURES_VENTES = 10;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);

  const url = new URL(request.url);
  const decalagePeriode = decalagePeriodeDepuisParam(url.searchParams.get("periode"));
  const periode = periodeDecalee(boutique.periodicite, decalagePeriode);

  const meilleuresVentes = await obtenirMeilleuresVentes(
    session.shop,
    periode.debut,
    periode.fin,
    NOMBRE_MEILLEURES_VENTES,
  );

  return { decalagePeriode, periodeLabel: periode.label, meilleuresVentes };
};

export default function Statistiques() {
  const { decalagePeriode, periodeLabel, meilleuresVentes } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Statistiques">
      <s-banner tone="info">
        <s-paragraph>
          Informatif uniquement : ces chiffres ne remplacent pas le livre des recettes,
          seule source du CA déclaré à l&apos;URSSAF (un article peut par exemple être
          remboursé après coup sans que ce classement ne change).
        </s-paragraph>
      </s-banner>

      <s-section heading="Meilleures ventes">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-link href={`/app/statistiques?periode=${decalagePeriode - 1}`}>← Période précédente</s-link>
            <s-text type="strong">{periodeLabel}</s-text>
            {decalagePeriode < 0 ? (
              <s-link href={`/app/statistiques?periode=${decalagePeriode + 1}`}>Période suivante →</s-link>
            ) : (
              <s-text color="subdued">Période suivante →</s-text>
            )}
          </s-stack>

          {meilleuresVentes.length === 0 ? (
            <s-box padding="large" background="subdued" borderRadius="large">
              <s-stack direction="block" gap="small-200" alignItems="center">
                <s-icon type="chart-vertical" tone="neutral" />
                <s-text color="subdued">Aucune vente de produit sur cette période.</s-text>
              </s-stack>
            </s-box>
          ) : (
            <s-table variant="list" paginate={false}>
              <s-table-header-row>
                <s-table-header listSlot="primary">Produit</s-table-header>
                <s-table-header>Quantité vendue</s-table-header>
                <s-table-header format="currency">CA généré</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {meilleuresVentes.map((produit) => (
                  <s-table-row key={produit.titreProduit}>
                    <s-table-cell>{produit.titreProduit}</s-table-cell>
                    <s-table-cell>{produit.quantite}</s-table-cell>
                    <s-table-cell>{formateurEUR.format(produit.montant)}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-stack>
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
