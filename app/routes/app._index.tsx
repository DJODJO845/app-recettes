import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";

import { authenticate } from "../shopify.server";
import { obtenirOuCreerBoutique } from "../lib/db/boutique.server";
import { calculerTotauxDashboard } from "../lib/db/totaux.server";
import { listerDernieresLignes } from "../lib/db/lignesLivre.server";
import { importerCommandesRecentes } from "../lib/shopify/importerCommandes.server";
import { plafondAnnuel, type NiveauAlertePlafond } from "../lib/domain/reglementation";
import { BanniereExport } from "../lib/ui/BanniereExport";
import { MentionLegale } from "../lib/ui/MentionLegale";

const NOMBRE_DERNIERES_RECETTES = 5;

const COULEUR_ALERTE: Record<NiveauAlertePlafond, string> = {
  ok: "#008060",
  avertissement: "#B98900",
  critique: "#D82C0D",
};

// Polaris limite volontairement les fonds de s-box à des gris neutres (une app
// embarquée ne doit pas jurer avec les couleurs propres d'Admin). Pour un peu
// de couleur sans sortir de cette contrainte, on ajoute des teintes légères en
// accent — icône dans un cercle teinté, chiffre-clé coloré — plutôt que des
// fonds de carte colorés.
const TEINTE_ALERTE: Record<NiveauAlertePlafond, string> = {
  ok: "#E3F1EC",
  avertissement: "#FCF1D8",
  critique: "#FBEAE5",
};

function CercleIcone({
  type,
  tone,
  fond,
}: {
  type: string;
  tone: "success" | "warning" | "critical";
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
      <s-icon type={type as "cash-euro" | "gauge"} tone={tone} />
    </div>
  );
}

const BADGE_ALERTE = {
  ok: { tone: "success", label: "OK", icone: "check-circle-filled" },
  avertissement: { tone: "warning", label: "Attention", icone: "alert-triangle" },
  critique: { tone: "critical", label: "Critique", icone: "alert-diamond" },
} as const satisfies Record<NiveauAlertePlafond, { tone: "success" | "warning" | "critical"; label: string; icone: string }>;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);

  try {
    await importerCommandesRecentes(admin, session.shop, boutique.dateDebutActivite);
  } catch (erreur) {
    // On n'empêche pas l'affichage du tableau de bord si l'import échoue (ex. souci
    // réseau ponctuel) : on montre les données déjà en base et on journalise l'erreur.
    // On extrait explicitement graphQLErrors : les logs par défaut le tronquent en
    // "[Array]" (limite de profondeur de console.error), ce qui masque le vrai message.
    const graphQLErrors = (erreur as { graphQLErrors?: unknown })?.graphQLErrors;
    console.error(
      "Échec de l'import des commandes Shopify :",
      erreur instanceof Error ? erreur.message : erreur,
      graphQLErrors ? JSON.stringify(graphQLErrors) : "",
    );
  }

  const totaux = await calculerTotauxDashboard(
    session.shop,
    boutique.periodicite,
    boutique.typeActivite,
  );

  const plafond = plafondAnnuel(boutique.typeActivite.toLowerCase() as "commerce" | "services" | "mixte");
  const pourcentagePlafond = Math.min(100, Math.round((totaux.caAnnuelEncaisse / plafond) * 100));

  const dernieresLignes = await listerDernieresLignes(session.shop, NOMBRE_DERNIERES_RECETTES);

  return { totaux, plafond, pourcentagePlafond, dernieresLignes };
};

const formateurEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const formateurDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default function Dashboard() {
  const { totaux, plafond, pourcentagePlafond, dernieresLignes } = useLoaderData<typeof loader>();
  const badge = BADGE_ALERTE[totaux.niveauAlerte];

  return (
    <s-page heading="Tableau de bord">
      <BanniereExport />

      {totaux.caPeriodeCourante === 0 && (
        <s-banner tone="info">
          <s-paragraph>
            Aucun encaissement sur cette période. Une déclaration à 0 € reste
            obligatoire auprès de l&apos;URSSAF.
          </s-paragraph>
        </s-banner>
      )}

      <s-section>
        <s-grid gridTemplateColumns="@container (inline-size < 28rem) 1fr, 1fr 1fr" gap="base">
          <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
            <s-stack direction="block" gap="small-200">
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <CercleIcone type="cash-euro" tone="success" fond={TEINTE_ALERTE.ok} />
                <s-text type="strong" color="subdued">CA encaissé — {totaux.periode.label}</s-text>
              </s-stack>
              <div style={{ color: COULEUR_ALERTE.ok, fontSize: "28px", fontWeight: 700, lineHeight: 1.2 }}>
                {formateurEUR.format(totaux.caPeriodeCourante)}
              </div>
              <s-text color="subdued">Montant à déclarer à l&apos;URSSAF pour cette période</s-text>
            </s-stack>
          </s-box>

          <s-box padding="large" borderWidth="base" borderRadius="large" background="subdued">
            <s-stack direction="block" gap="small-200">
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <CercleIcone type="gauge" tone={badge.tone} fond={TEINTE_ALERTE[totaux.niveauAlerte]} />
                <s-text type="strong" color="subdued">Plafond annuel</s-text>
              </s-stack>
              <div style={{ color: COULEUR_ALERTE[totaux.niveauAlerte], fontSize: "28px", fontWeight: 700, lineHeight: 1.2 }}>
                {pourcentagePlafond}%
              </div>
              <div>
                <s-badge tone={badge.tone} icon={badge.icone}>{badge.label}</s-badge>
              </div>
              <s-text color="subdued">
                {formateurEUR.format(totaux.caAnnuelEncaisse)} sur {formateurEUR.format(plafond)}
              </s-text>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Jauge du plafond annuel">
        <s-stack direction="block" gap="base">
          <div style={{ position: "relative", height: "16px", width: "100%", background: "#E1E3E5", borderRadius: "8px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pourcentagePlafond}%`,
                background: COULEUR_ALERTE[totaux.niveauAlerte],
                borderRadius: "8px",
                transition: "width 0.3s ease",
              }}
            />
            <div style={{ position: "absolute", left: "80%", top: 0, bottom: 0, width: "2px", background: "rgba(0,0,0,0.25)" }} />
            <div style={{ position: "absolute", left: "95%", top: 0, bottom: 0, width: "2px", background: "rgba(0,0,0,0.25)" }} />
          </div>
          <s-stack direction="inline" justifyContent="space-between">
            <s-text color="subdued">0 €</s-text>
            <s-text color="subdued">Seuils d&apos;alerte : 80 % et 95 %</s-text>
            <s-text color="subdued">{formateurEUR.format(plafond)}</s-text>
          </s-stack>
          {totaux.niveauAlerte === "avertissement" && (
            <s-banner tone="warning">
              <s-paragraph>
                Vous approchez du plafond annuel (80 %). Pensez à anticiper la suite.
              </s-paragraph>
            </s-banner>
          )}
          {totaux.niveauAlerte === "critique" && (
            <s-banner tone="critical">
              <s-paragraph>
                Attention, vous dépassez 95 % du plafond annuel. Rapprochez-vous d&apos;un
                expert-comptable ou de l&apos;URSSAF rapidement.
              </s-paragraph>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Dernières recettes">
        {dernieresLignes.length === 0 ? (
          <s-box padding="large" background="subdued" borderRadius="large">
            <s-stack direction="block" gap="small-200" alignItems="center">
              <s-icon type="receipt" tone="neutral" />
              <s-text color="subdued">Aucune recette pour le moment.</s-text>
            </s-stack>
          </s-box>
        ) : (
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-300">
              {dernieresLignes.map((ligne, index) => (
                <s-stack key={ligne.id} direction="block" gap="small-300">
                  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-stack direction="block" gap="small-100">
                      <s-text type="strong">{ligne.reference}</s-text>
                      <s-text color="subdued">{formateurDate.format(new Date(ligne.date))}</s-text>
                    </s-stack>
                    <s-text tone={ligne.montant < 0 ? "critical" : "success"} type="strong">
                      {formateurEUR.format(ligne.montant)}
                    </s-text>
                  </s-stack>
                  {index < dernieresLignes.length - 1 && <s-divider />}
                </s-stack>
              ))}
            </s-stack>
            <s-link href="/app/livre">Voir tout le livre des recettes →</s-link>
          </s-stack>
        )}
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
