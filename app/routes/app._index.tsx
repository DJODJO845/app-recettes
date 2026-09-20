import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";

import { authenticate } from "../shopify.server";
import { obtenirOuCreerBoutique, enregistrerImportation } from "../lib/db/boutique.server";
import { calculerTotauxDashboard, calculerEvolutionMensuelle } from "../lib/db/totaux.server";
import { listerDernieresLignes } from "../lib/db/lignesLivre.server";
import { importerCommandesRecentes } from "../lib/shopify/importerCommandes.server";
import { REQUETE_DEVISE_BOUTIQUE, type DeviseBoutiqueResponse } from "../lib/shopify/graphql";
import { plafondAnnuel, type NiveauAlertePlafond } from "../lib/domain/reglementation";
import { BanniereExport } from "../lib/ui/BanniereExport";
import { MentionLegale } from "../lib/ui/MentionLegale";
import { CercleIcone } from "../lib/ui/CercleIcone";
import { formateurEUR, formateurDate } from "../lib/ui/formateurs";

const NOMBRE_DERNIERES_RECETTES = 5;
const NOMBRE_MOIS_EVOLUTION = 6;
const JOURS_AVANT_RAPPEL_EXPORT = 30;
// Marge de recouvrement lors d'un import incrémental, pour couvrir tout décalage
// d'indexation côté Shopify entre deux visites plutôt que de risquer de manquer
// une commande créée juste avant le dernier import.
const JOURS_MARGE_IMPORT_INCREMENTAL = 1;

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

const BADGE_ALERTE = {
  ok: { tone: "success", label: "OK", icone: "check-circle-filled" },
  avertissement: { tone: "warning", label: "Attention", icone: "alert-triangle" },
  critique: { tone: "critical", label: "Critique", icone: "alert-diamond" },
} as const satisfies Record<NiveauAlertePlafond, { tone: "success" | "warning" | "critical"; label: string; icone: string }>;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);

  try {
    // Import incrémental : on ne repart de dateDebutActivite en entier que la
    // première fois (ou juste après un changement de cette date, qui remet
    // derniereImportation à null — voir mettreAJourReglages) ; sinon on ne
    // redemande à Shopify que les commandes MODIFIÉES depuis le dernier import
    // réussi (pas seulement créées — voir importerCommandesRecentes pour pourquoi),
    // pour éviter de retélécharger tout l'historique à chaque visite.
    const depuis = boutique.derniereImportation
      ? new Date(boutique.derniereImportation.getTime() - JOURS_MARGE_IMPORT_INCREMENTAL * 24 * 60 * 60 * 1000)
      : boutique.dateDebutActivite;

    await importerCommandesRecentes(admin, session.shop, depuis, boutique.dateDebutActivite);
    await enregistrerImportation(session.shop);
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

  // Tous les montants affichés supposent que la boutique est en euros (amountSet
  // renvoie la devise de la boutique, pas forcément EUR) : sans cette vérification,
  // une boutique dans une autre devise verrait ses montants affichés avec un "€"
  // trompeur, sans le savoir.
  let deviseBoutique = "EUR";
  try {
    const reponseDevise = await admin.graphql(REQUETE_DEVISE_BOUTIQUE);
    const jsonDevise = (await reponseDevise.json()) as DeviseBoutiqueResponse;
    deviseBoutique = jsonDevise.data.shop.currencyCode;
  } catch (erreur) {
    console.error("Échec de la vérification de la devise de la boutique :", erreur);
  }

  const totaux = await calculerTotauxDashboard(
    session.shop,
    boutique.periodicite,
    boutique.typeActivite,
  );

  const plafond = plafondAnnuel(boutique.typeActivite.toLowerCase() as "commerce" | "services" | "mixte");
  const plafondServices = plafondAnnuel("services");
  const pourcentagePlafond = Math.min(100, Math.round((totaux.caAnnuelEncaisse / plafond) * 100));

  const dernieresLignes = await listerDernieresLignes(session.shop, NOMBRE_DERNIERES_RECETTES);
  const evolutionMensuelle = await calculerEvolutionMensuelle(session.shop, NOMBRE_MOIS_EVOLUTION);

  const joursDepuisExport = boutique.derniereExportation
    ? Math.floor((Date.now() - boutique.derniereExportation.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const doitRappelerExport = joursDepuisExport === null || joursDepuisExport >= JOURS_AVANT_RAPPEL_EXPORT;

  return {
    totaux,
    plafond,
    plafondServices,
    pourcentagePlafond,
    dernieresLignes,
    evolutionMensuelle,
    doitRappelerExport,
    typeActivite: boutique.typeActivite,
    deviseBoutique,
  };
};

export default function Dashboard() {
  const {
    totaux,
    plafond,
    plafondServices,
    pourcentagePlafond,
    dernieresLignes,
    evolutionMensuelle,
    doitRappelerExport,
    typeActivite,
    deviseBoutique,
  } = useLoaderData<typeof loader>();
  const badge = BADGE_ALERTE[totaux.niveauAlerte];
  const maxEvolution = Math.max(...evolutionMensuelle.map((point) => point.ca), 1);

  return (
    <s-page heading="Tableau de bord">
      {deviseBoutique !== "EUR" && (
        <s-banner tone="critical" heading="Boutique configurée hors euros">
          <s-paragraph>
            Votre boutique Shopify utilise la devise {deviseBoutique}, pas l&apos;euro.
            Tous les montants affichés dans cette app sont pourtant présentés en euros
            (€) : ils ne correspondent donc pas à votre CA réel en EUR. Ne déclarez pas
            ces chiffres à l&apos;URSSAF tant que ce point n&apos;est pas résolu.
          </s-paragraph>
        </s-banner>
      )}

      {doitRappelerExport && <BanniereExport />}

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
          {typeActivite === "MIXTE" && (
            <s-banner tone="info">
              <s-paragraph>
                Activité mixte : cette jauge ne suit que le plafond global. La part
                « services » de votre CA a aussi son propre sous-plafond
                ({formateurEUR.format(plafondServices)}), que l&apos;app ne
                distingue pas automatiquement — vérifiez-le de votre côté ou avec
                un expert-comptable.
              </s-paragraph>
            </s-banner>
          )}
          {totaux.niveauAlerte === "avertissement" && (
            <s-banner tone="warning">
              <s-paragraph>
                Vous approchez du plafond annuel (80 %). Le dépasser peut remettre
                en cause votre régime micro-entrepreneur : anticipez avec un
                expert-comptable si vous pensez le dépasser cette année.
              </s-paragraph>
              <s-button slot="primary-action" href="https://www.autoentrepreneur.urssaf.fr" target="_blank">
                Voir le site de l&apos;URSSAF
              </s-button>
            </s-banner>
          )}
          {totaux.niveauAlerte === "critique" && (
            <s-banner tone="critical">
              <s-paragraph>
                Attention, vous dépassez 95 % du plafond annuel. Rapprochez-vous d&apos;un
                expert-comptable ou de l&apos;URSSAF rapidement.
              </s-paragraph>
              <s-button slot="primary-action" href="https://www.autoentrepreneur.urssaf.fr" target="_blank">
                Voir le site de l&apos;URSSAF
              </s-button>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Évolution du CA encaissé">
        <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "150px" }}>
          {evolutionMensuelle.map((point, index) => {
            const estMoisCourant = index === evolutionMensuelle.length - 1;
            const hauteur = point.ca > 0 ? Math.max(4, Math.round((point.ca / maxEvolution) * 110)) : 4;

            return (
              <div
                key={`${point.label}-${index}`}
                title={`${point.label} : ${formateurEUR.format(point.ca)}`}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
              >
                {estMoisCourant && (
                  <s-text color="subdued">{formateurEUR.format(point.ca)}</s-text>
                )}
                <div
                  style={{
                    width: "100%",
                    maxWidth: "40px",
                    height: `${hauteur}px`,
                    borderRadius: "4px 4px 0 0",
                    background: estMoisCourant ? COULEUR_ALERTE.ok : "#B4E0D3",
                    transition: "height 0.3s ease",
                  }}
                />
                <s-text color="subdued">{point.label}</s-text>
              </div>
            );
          })}
        </div>
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
