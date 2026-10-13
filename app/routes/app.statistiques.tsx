import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticateAdmin } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import {
  obtenirMeilleuresVentes,
  obtenirProduitsRembourses,
  obtenirTotalRembourse,
  obtenirTotalVentes,
} from "../lib/db/articlesVendus.server";
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
const NOMBRE_PRODUITS_REMBOURSEMENT = 5;
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
  // "Par année" par défaut (plutôt que "periode") : un premier aperçu annuel est plus
  // parlant pour une page informative que la période de déclaration en cours, souvent
  // plus courte (mensuelle) et donc moins représentative d'ensemble.
  const vue: Vue = url.searchParams.get("vue") === "periode" ? "periode" : "annee";

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

  const [meilleuresVentes, totalVentes, produitsRembourses, totalRembourse] = await Promise.all([
    obtenirMeilleuresVentes(session.shop, debut, fin, NOMBRE_MEILLEURES_VENTES),
    obtenirTotalVentes(session.shop, debut, fin),
    obtenirProduitsRembourses(session.shop, debut, fin, NOMBRE_PRODUITS_REMBOURSEMENT),
    obtenirTotalRembourse(session.shop, debut, fin),
  ]);

  return { vue, decalage, periodeLabel, meilleuresVentes, totalVentes, produitsRembourses, totalRembourse };
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
function libelleVente(vente: { titreProduit: string; titreVariante: string | null }): string {
  return vente.titreVariante ? `${vente.titreProduit} — ${vente.titreVariante}` : vente.titreProduit;
}

/**
 * Regroupe une liste (meilleures ventes OU produits remboursés) en tranches de
 * camembert : les N premières individuellement, le reste (au-delà de
 * NOMBRE_TRANCHES_CAMEMBERT, ou simplement non ramené par la requête) cumulé dans
 * "Autres" — calculé à partir du vrai total de la période (pas de la seule somme du
 * top affiché), pour que les pourcentages reflètent 100% même si "Autres" existe.
 * Générique aux deux usages : un camembert part-à-tout n'a de sens que pour une
 * grandeur qui s'additionne à 100% entre produits (CA, ou ici montant remboursé) —
 * jamais pour un taux individuel par produit (voir discussion du 13 octobre 2026).
 */
function construireTranches(
  elements: { titreProduit: string; titreVariante: string | null; montant: number }[],
  total: number,
): Tranche[] {
  if (total <= 0) return [];

  const top = elements.slice(0, NOMBRE_TRANCHES_CAMEMBERT);
  const montantTop = top.reduce((somme, element) => somme + element.montant, 0);
  const montantAutres = total - montantTop;

  const tranches: Tranche[] = top.map((element, index) => ({
    label: libelleVente(element),
    montant: element.montant,
    pourcentage: (element.montant / total) * 100,
    couleur: `var(${COULEURS_SERIES[index]})`,
  }));

  if (montantAutres > 0.005) {
    tranches.push({
      label: "Autres",
      montant: montantAutres,
      pourcentage: (montantAutres / total) * 100,
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

/** Camembert (donut) réutilisé pour les meilleures ventes et les produits remboursés. */
function Camembert({ tranches, total, libelleTotal }: { tranches: Tranche[]; total: number; libelleTotal: string }) {
  if (tranches.length === 0) return null;

  return (
    <s-stack direction="block" gap="base">
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
        <div style={{ position: "relative", width: "180px", height: "180px" }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: degradeConique(tranches) }} />
          {/* Anneau central (donut, pas un camembert plein) : place le total au centre
              de ce que le marchand regarde déjà, plutôt qu'un chiffre séparé ailleurs. */}
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
            <s-text color="subdued">{libelleTotal}</s-text>
            <s-text type="strong">{formateurEUR.format(total)}</s-text>
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
  );
}

function lienVue(vue: Vue, decalage: number): string {
  // "vue=periode" explicite nécessaire même si c'est la valeur non-"annee" : le défaut
  // du loader est "annee" (voir plus haut), donc un lien sans ce paramètre y
  // retomberait plutôt que de basculer sur la période.
  return vue === "annee" ? `/app/statistiques?vue=annee&annee=${decalage}` : `/app/statistiques?vue=periode&periode=${decalage}`;
}

export default function Statistiques() {
  const { vue, decalage, periodeLabel, meilleuresVentes, totalVentes, produitsRembourses, totalRembourse } = useLoaderData<typeof loader>();
  const tranches = construireTranches(meilleuresVentes, totalVentes);
  const tranchesRembourses = construireTranches(
    produitsRembourses.map((produit) => ({ ...produit, montant: produit.montantRembourse })),
    totalRembourse,
  );

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
            <Camembert tranches={tranches} total={totalVentes} libelleTotal="Total" />
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

      {produitsRembourses.length > 0 && (
        <s-section heading="Produits souvent remboursés">
          <s-stack direction="block" gap="base">
            <s-text color="subdued">
              Peut signaler un souci (taille, qualité, description) — ne compte pas
              dans le CA des meilleures ventes, qui exclut déjà ce qui est remboursé.
              Le pourcentage est la part de CE produit dans le total remboursé de la
              période, pas son propre taux de remboursement.
            </s-text>

            <Camembert tranches={tranchesRembourses} total={totalRembourse} libelleTotal="Total remboursé" />

            <s-table variant="list" paginate={false}>
              <s-table-header-row>
                <s-table-header listSlot="primary">Produit</s-table-header>
                <s-table-header format="currency">Montant remboursé</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {produitsRembourses.map((produit) => (
                  <s-table-row key={`${produit.titreProduit}-${produit.titreVariante ?? ""}`}>
                    <s-table-cell>{libelleVente(produit)}</s-table-cell>
                    <s-table-cell>{formateurEUR.format(produit.montantRembourse)}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </s-stack>
        </s-section>
      )}

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
