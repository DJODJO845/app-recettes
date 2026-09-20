import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { listerLignes } from "../lib/db/lignesLivre.server";
import { MentionLegale } from "../lib/ui/MentionLegale";
import type { NatureLigneLivre } from "../lib/domain/types";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";

const LIBELLES_NATURE: Record<NatureLigneLivre, string> = {
  vente: "Vente",
  vente_carte_cadeau: "Vente de carte cadeau",
  reglement_carte_cadeau: "Règlement par carte cadeau",
  remboursement: "Remboursement",
};

const BADGE_NATURE = {
  vente: { tone: "success", icon: "check-circle-filled" },
  vente_carte_cadeau: { tone: "info", icon: "gift-card" },
  reglement_carte_cadeau: { tone: "info", icon: "gift-card" },
  remboursement: { tone: "critical", icon: "arrow-left" },
} as const satisfies Record<NatureLigneLivre, { tone: "success" | "info" | "critical"; icon: string }>;

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
          <s-box padding="large" background="subdued" borderRadius="large">
            <s-stack direction="block" gap="small-200" alignItems="center">
              <s-icon type="book-open" tone="neutral" />
              <s-text color="subdued">Aucune ligne sur cette période.</s-text>
            </s-stack>
          </s-box>
        ) : (
          <s-table variant="list" paginate={false}>
            <s-table-header-row>
              <s-table-header listSlot="primary">Date</s-table-header>
              <s-table-header>Référence</s-table-header>
              <s-table-header>Client</s-table-header>
              <s-table-header>Nature</s-table-header>
              <s-table-header>Mode de règlement</s-table-header>
              <s-table-header>Canal</s-table-header>
              <s-table-header format="currency">Montant</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {lignes.map((ligne) => (
                <s-table-row key={ligne.id}>
                  <s-table-cell>{formateurDate.format(new Date(ligne.date))}</s-table-cell>
                  <s-table-cell>{ligne.reference}</s-table-cell>
                  <s-table-cell>{ligne.client}</s-table-cell>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-200">
                      <s-badge tone={BADGE_NATURE[ligne.nature].tone} icon={BADGE_NATURE[ligne.nature].icon}>
                        {LIBELLES_NATURE[ligne.nature]}
                      </s-badge>
                      {!ligne.compteDansCA && (
                        <s-text color="subdued">Déjà comptée à l&apos;achat de la carte</s-text>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{ligne.modeReglement}</s-table-cell>
                  <s-table-cell>{ligne.canal}</s-table-cell>
                  <s-table-cell>
                    <s-text tone={ligne.montant < 0 ? "critical" : "success"} type="strong">
                      {formateurEUR.format(ligne.montant)}
                    </s-text>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
