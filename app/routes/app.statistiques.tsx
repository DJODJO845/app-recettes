import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticateAdmin } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import { obtenirMeilleuresVentes, obtenirTotalVentes, type MeilleureVente } from "../lib/db/articlesVendus.server";
import {
  decalageAnneeDepuisParam,
  decalagePeriodeDepuisParam,
  periodeAnneeDecalee,
  periodeDecalee,
} from "../lib/domain/periode";
import { MentionLegale } from "../lib/ui/MentionLegale";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";
import { formateurEUR } from "../lib/ui/formateurs";

const NOMBRE_MEILLEURES_VENTES = 10;
// Au-delà de 6 tranches nommées, un camembert devient illisible (voir dataviz) — le
// reste est regroupé dans "Autres" plutôt que d'ajouter une 7e couleur générée (non
// distinguable de façon fiable pour le daltonisme).
const NOMBRE_TRANCHES_CAMEMBERT = 6;
const COULEURS_SERIES = ["--serie-1", "--serie-2", "--serie-3", "--serie-4", "--serie-5", "--serie-6"] as const;

type Vue = "periode" | "annee";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);

  const url = new URL(request.url);
  const vue: Vue = url.searchParams.get("vue") === "annee" ? "annee" : "periode";

  let debut: Date;
  let fin: Date;
  let periodeLabel: string;
  let decalage: number;

  if (vue === "annee") {
    decalage = decalageAnneeDepuisParam(url.searchParams.get("annee"));
    const periodeAnnee = periodeAnneeDecalee(decalage);
    debut = periodeAnnee.debut;
    fin = periodeAnnee.fin;
    periodeLabel = periodeAnnee.label;
  } else {
    decalage = decalagePeriodeDepuisParam(url.searchParams.get("periode"));
    const periode = periodeDecalee(boutique.periodicite, decalage);
    debut = periode.debut;
    fin = periode.fin;
    periodeLabel = periode.label;
  }

  const [meilleuresVentes, totalVentes] = await Promise.all([
    obtenirMeilleuresVentes(session.shop, debut, fin, NOMBRE_MEILLEURES_VENTES),
    obtenirTotalVentes(session.shop, debut, fin),
  ]);

  return { vue, decalage, periodeLabel, meilleuresVentes, totalVentes };
};

interface Tranche {
  label: string;
  montant: number;
  pourcentage: number;
  couleur: string;
}

/** "The Complete Snowboard — Dawn" plutôt que juste "The Complete Snowboard" : la
 * variante (taille, couleur...) est l'info qu'un marchand regarde pour savoir quelle
 * déclinaison précise se vend. */
function libelleVente(vente: MeilleureVente): string {
  return vente.titreVariante ? `${vente.titreProduit} — ${vente.titreVariante}` : vente.titreProduit;
}

/**
 * Regroupe les meilleures ventes en tranches de camembert : les N premières
 * individuellement, le reste (au-delà de NOMBRE_TRANCHES_CAMEMBERT, ou simplement non
 * demandé à obtenirMeilleuresVentes) cumulé dans "Autres" — calculé à partir du vrai
 * total de la période (obtenirTotalVentes), pas de la seule somme du top affiché,
 * pour que les pourcentages reflètent 100% des ventes même si "Autres" existe.
 */
function construireTranches(meilleuresVentes: MeilleureVente[], totalVentes: number): Tranche[] {
  if (totalVentes <= 0) return [];

  const top = meilleuresVentes.slice(0, NOMBRE_TRANCHES_CAMEMBERT);
  const montantTop = top.reduce((somme, vente) => somme + vente.montant, 0);
  const montantAutres = totalVentes - montantTop;

  const tranches: Tranche[] = top.map((vente, index) => ({
    label: libelleVente(vente),
    montant: vente.montant,
    pourcentage: (vente.montant / totalVentes) * 100,
    couleur: `var(${COULEURS_SERIES[index]})`,
  }));

  if (montantAutres > 0.005) {
    tranches.push({
      label: "Autres",
      montant: montantAutres,
      pourcentage: (montantAutres / totalVentes) * 100,
      couleur: "var(--serie-autres)",
    });
  }

  return tranches;
}

/** Dégradé conique CSS pour le camembert, à partir des pourcentages cumulés des tranches. */
function degradeConique(tranches: Tranche[]): string {
  let cumul = 0;
  const segments = tranches.map((tranche) => {
    const debut = cumul;
    cumul += tranche.pourcentage;
    return `${tranche.couleur} ${debut}% ${cumul}%`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function lienVue(vue: Vue, decalage: number): string {
  return vue === "annee" ? `/app/statistiques?vue=annee&annee=${decalage}` : `/app/statistiques?periode=${decalage}`;
}

export default function Statistiques() {
  const { vue, decalage, periodeLabel, meilleuresVentes, totalVentes } = useLoaderData<typeof loader>();
  const tranches = construireTranches(meilleuresVentes, totalVentes);

  return (
    <s-page heading="Statistiques">
      {/* Palette catégorielle validée (contraste + daltonisme) pour le camembert — voir
          dataviz skill. Ses propres variables (pas --couleur-*, réservées aux signaux
          d'état ok/avertissement/critique ailleurs dans l'app) pour ne jamais confondre
          une couleur de produit avec un signal d'alerte. */}
      <style>{`
        :root {
          --serie-1: #2a78d6; --serie-2: #eb6834; --serie-3: #1baf7a;
          --serie-4: #eda100; --serie-5: #e87ba4; --serie-6: #6250d6;
          --serie-autres: #898781;
          --fond-camembert: #ffffff;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --serie-1: #3987e5; --serie-2: #d95926; --serie-3: #199e70;
            --serie-4: #c98500; --serie-5: #d55181; --serie-6: #9085e9;
            --serie-autres: #898781;
            --fond-camembert: #1a1a1a;
          }
        }
      `}</style>

      <s-banner tone="info">
        <s-paragraph>
          Informatif uniquement : le total correspond au livre des recettes (frais de
          port, remises et remboursements inclus), mais la répartition par produit
          reste une estimation — répartie au prorata, car Shopify ne précise pas
          toujours quel article précis porte une remise ou un remboursement.
        </s-paragraph>
      </s-banner>

      <s-section heading="Meilleures ventes">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="small-300">
            {vue === "periode" ? (
              <s-text type="strong">Par période</s-text>
            ) : (
              <s-link href={lienVue("periode", -1)}>Par période</s-link>
            )}
            <s-text color="subdued">·</s-text>
            {vue === "annee" ? (
              <s-text type="strong">Par année</s-text>
            ) : (
              <s-link href={lienVue("annee", 0)}>Par année</s-link>
            )}
          </s-stack>

          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-link href={lienVue(vue, decalage - 1)}>← Précédent</s-link>
            <s-text type="strong">{periodeLabel}</s-text>
            {decalage < 0 ? (
              <s-link href={lienVue(vue, decalage + 1)}>Suivant →</s-link>
            ) : (
              <s-text color="subdued">Suivant →</s-text>
            )}
          </s-stack>

          {tranches.length === 0 ? (
            <s-box padding="large" background="subdued" borderRadius="large">
              <s-stack direction="block" gap="small-200" alignItems="center">
                <s-icon type="chart-vertical" tone="neutral" />
                <s-text color="subdued">Aucune vente de produit sur cette période.</s-text>
              </s-stack>
            </s-box>
          ) : (
            <s-stack direction="block" gap="base">
              <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
                <div style={{ position: "relative", width: "180px", height: "180px" }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: degradeConique(tranches) }} />
                  {/* Anneau central (donut, pas un camembert plein) : place le CA total,
                      le chiffre que le marchand regarde en premier, au centre de ce qu'il
                      regarde déjà — plutôt qu'un chiffre séparé ailleurs sur la page. */}
                  <div
                    style={{
                      position: "absolute",
                      inset: "28px",
                      borderRadius: "50%",
                      background: "var(--fond-camembert)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                    }}
                  >
                    <s-text color="subdued">Total</s-text>
                    <s-text type="strong">{formateurEUR.format(totalVentes)}</s-text>
                  </div>
                </div>
              </div>

              <s-stack direction="block" gap="small-300">
                {tranches.map((tranche) => (
                  <s-stack key={tranche.label} direction="inline" justifyContent="space-between" alignItems="center">
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: tranche.couleur, flexShrink: 0 }} />
                      <s-text>{tranche.label}</s-text>
                    </s-stack>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-text color="subdued">{tranche.pourcentage.toFixed(1)} %</s-text>
                      <s-text type="strong">{formateurEUR.format(tranche.montant)}</s-text>
                    </s-stack>
                  </s-stack>
                ))}
              </s-stack>
            </s-stack>
          )}
        </s-stack>
      </s-section>

      {meilleuresVentes.length > 0 && (
        <s-section heading="Détail">
          <s-table variant="list" paginate={false}>
            <s-table-header-row>
              <s-table-header listSlot="primary">Produit</s-table-header>
              <s-table-header>Quantité vendue</s-table-header>
              <s-table-header format="currency">CA généré</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {meilleuresVentes.map((produit) => (
                <s-table-row key={`${produit.titreProduit}-${produit.titreVariante ?? ""}`}>
                  <s-table-cell>{libelleVente(produit)}</s-table-cell>
                  <s-table-cell>{produit.quantite}</s-table-cell>
                  <s-table-cell>{formateurEUR.format(produit.montant)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
