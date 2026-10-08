import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";

import { authenticateAdmin } from "../shopify.server";
import { obtenirOuCreerBoutique, enregistrerImportation } from "../lib/db/boutique.server";
import { calculerTotauxDashboard, calculerEvolutionMensuelle, calculerComparaisonAnnuelle } from "../lib/db/totaux.server";
import { listerDernieresLignes } from "../lib/db/lignesLivre.server";
import { importerCommandesRecentes } from "../lib/shopify/importerCommandes.server";
import { REQUETE_DEVISE_BOUTIQUE, type DeviseBoutiqueResponse } from "../lib/shopify/graphql";
import { plafondAnnuel, seuilsAlerte, projectionDatePlafond, type NiveauAlertePlafond } from "../lib/domain/reglementation";
import { BanniereExport } from "../lib/ui/BanniereExport";
import { TexteDepliable } from "../lib/ui/TexteDepliable";
import { joursDepuis } from "../lib/ui/dateRelative";
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

// Valeurs posées en variables CSS (voir <style> dans le composant, même pattern que
// --piste-jauge) plutôt qu'en hex figé ici : sans ça, ces couleurs fortes et teintes
// pastel ne s'adaptaient pas au mode sombre — un cercle pastel très clair ressort comme
// un flash blanc agressif sur fond sombre, et le jaune devient peu lisible.
const COULEUR_ALERTE: Record<NiveauAlertePlafond, string> = {
  ok: "var(--couleur-ok)",
  avertissement: "var(--couleur-avertissement)",
  critique: "var(--couleur-critique)",
};

// Polaris limite volontairement les fonds de s-box à des gris neutres (une app
// embarquée ne doit pas jurer avec les couleurs propres d'Admin). Pour un peu
// de couleur sans sortir de cette contrainte, on ajoute des teintes légères en
// accent — icône dans un cercle teinté, chiffre-clé coloré — plutôt que des
// fonds de carte colorés.
const TEINTE_ALERTE: Record<NiveauAlertePlafond, string> = {
  ok: "var(--tinte-ok)",
  avertissement: "var(--tinte-avertissement)",
  critique: "var(--tinte-critique)",
};

const BADGE_ALERTE = {
  ok: { tone: "success", label: "OK", icone: "check-circle-filled" },
  avertissement: { tone: "warning", label: "Attention", icone: "alert-triangle" },
  critique: { tone: "critical", label: "Critique", icone: "alert-diamond" },
} as const satisfies Record<NiveauAlertePlafond, { tone: "success" | "warning" | "critical"; label: string; icone: string }>;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticateAdmin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);

  // Import des commandes et vérification de la devise sont deux appels Shopify
  // indépendants : les lancer en parallèle (plutôt que l'un après l'autre) évite de
  // payer deux fois la latence réseau à chaque chargement du tableau de bord (chaque
  // appel observé à ~1-1,5s en review le 6 octobre 2026, d'où un /app perçu comme lent).
  const [resultatImport, resultatDevise] = await Promise.allSettled([
    (async () => {
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
    })(),
    (async () => {
      const reponseDevise = await admin.graphql(REQUETE_DEVISE_BOUTIQUE);
      const jsonDevise = (await reponseDevise.json()) as DeviseBoutiqueResponse;
      return jsonDevise.data.shop.currencyCode;
    })(),
  ]);

  if (resultatImport.status === "rejected") {
    // On n'empêche pas l'affichage du tableau de bord si l'import échoue (ex. souci
    // réseau ponctuel) : on montre les données déjà en base et on journalise l'erreur.
    // On extrait explicitement graphQLErrors : les logs par défaut le tronquent en
    // "[Array]" (limite de profondeur de console.error), ce qui masque le vrai message.
    // admin.graphql() lève directement la Response brute (pas une Error) quand le HTTP
    // n'est pas 2xx : son body n'est alors jamais lu nulle part, donc le message réel
    // de Shopify restait invisible dans les logs (vu en review le 6 octobre 2026 : un
    // 403 sans aucun détail exploitable).
    const erreur = resultatImport.reason;
    const graphQLErrors = (erreur as { graphQLErrors?: unknown })?.graphQLErrors;
    const corpsReponse = erreur instanceof Response ? await erreur.clone().text().catch(() => "") : "";
    console.error(
      "Échec de l'import des commandes Shopify :",
      erreur instanceof Error ? erreur.message : erreur,
      graphQLErrors ? JSON.stringify(graphQLErrors) : "",
      corpsReponse,
    );
  }

  // Tous les montants affichés supposent que la boutique est en euros (amountSet
  // renvoie la devise de la boutique, pas forcément EUR) : sans cette vérification,
  // une boutique dans une autre devise verrait ses montants affichés avec un "€"
  // trompeur, sans le savoir.
  let deviseBoutique = "EUR";
  if (resultatDevise.status === "fulfilled") {
    deviseBoutique = resultatDevise.value;
  } else {
    const erreur = resultatDevise.reason;
    const corpsReponse = erreur instanceof Response ? await erreur.clone().text().catch(() => "") : "";
    console.error("Échec de la vérification de la devise de la boutique :", erreur, corpsReponse);
  }

  // Quatre lectures indépendantes (aucune ne dépend du résultat des autres) : les
  // lancer en parallèle évite de payer l'aller-retour réseau vers Supabase (hébergé
  // en Irlande, alors que Render tourne en Ohio — chaque requête compte) autant de
  // fois qu'il y a de lectures.
  const [totaux, dernieresLignes, evolutionMensuelle, comparaisonAnnuelle] = await Promise.all([
    calculerTotauxDashboard(session.shop, boutique.periodicite, boutique.typeActivite),
    listerDernieresLignes(session.shop, NOMBRE_DERNIERES_RECETTES),
    calculerEvolutionMensuelle(session.shop, NOMBRE_MOIS_EVOLUTION),
    calculerComparaisonAnnuelle(session.shop),
  ]);

  const plafond = plafondAnnuel(boutique.typeActivite.toLowerCase() as "commerce" | "services" | "mixte");
  const plafondServices = plafondAnnuel("services");
  const pourcentagePlafond = Math.min(100, Math.round((totaux.caAnnuelEncaisse / plafond) * 100));
  // Lus depuis config/reglementation.json (jamais codés en dur, cf. reglementation.ts) :
  // les repères de la jauge doivent toujours correspondre exactement aux seuils qui
  // déterminent totaux.niveauAlerte, sans quoi un changement de seuil dans la config
  // désynchroniserait silencieusement l'affichage (repères/texte) du vrai niveau d'alerte.
  const seuils = seuilsAlerte();
  const pourcentageAvertissement = Math.round(seuils.avertissement * 100);
  const pourcentageCritique = Math.round(seuils.critique * 100);

  const doitRappelerExport =
    !boutique.derniereExportation || joursDepuis(boutique.derniereExportation) >= JOURS_AVANT_RAPPEL_EXPORT;

  const dateProjeteePlafond = projectionDatePlafond(
    totaux.caAnnuelEncaisse,
    plafond,
    boutique.dateDebutActivite,
    new Date(),
  );

  return {
    totaux,
    plafond,
    plafondServices,
    pourcentagePlafond,
    dernieresLignes,
    evolutionMensuelle,
    comparaisonAnnuelle,
    doitRappelerExport,
    typeActivite: boutique.typeActivite,
    deviseBoutique,
    pourcentageAvertissement,
    pourcentageCritique,
    dateProjeteePlafond,
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
    comparaisonAnnuelle,
    doitRappelerExport,
    typeActivite,
    deviseBoutique,
    pourcentageAvertissement,
    pourcentageCritique,
    dateProjeteePlafond,
  } = useLoaderData<typeof loader>();
  const badge = BADGE_ALERTE[totaux.niveauAlerte];
  const maxEvolution = Math.max(...evolutionMensuelle.map((point) => point.ca), 1);

  return (
    <s-page heading="Tableau de bord">
      {/* Les composants Polaris (s-box, s-text...) s'adaptent seuls au mode sombre de
          l'Admin Shopify, mais pas les quelques éléments custom ci-dessous (jauge,
          graphique) qui utilisent des couleurs codées en dur : sans ça, par exemple, les
          traits de seuil de la jauge (noir semi-transparent, pensés pour un fond clair)
          deviendraient quasi invisibles sur un fond sombre. */}
      {/* Les variables --couleur-… et --tinte-… sont définies une fois pour toutes dans
          app.tsx (layout partagé par toutes les pages /app) : seules les variables
          propres à cette page (jauge, graphique) restent définies ici. */}
      <style>{`
        :root { --piste-jauge: #E1E3E5; --repere-jauge: rgba(0,0,0,0.35); --barre-graphique-passee: #B4E0D3; }
        @media (prefers-color-scheme: dark) {
          :root { --piste-jauge: #4A4E54; --repere-jauge: rgba(255,255,255,0.45); --barre-graphique-passee: #2E5F4E; }
        }
      `}</style>
      {deviseBoutique !== "EUR" && (
        <s-banner tone="critical" heading="Boutique configurée hors euros">
          <TexteDepliable
            premierePhrase={`Votre boutique Shopify utilise la devise ${deviseBoutique}, pas l'euro : changez la devise de votre boutique pour que cette app redevienne fiable.`}
            reste={`Les montants affichés ici sont pourtant présentés avec un symbole "€" : en réalité, ce sont des montants en ${deviseBoutique}, pas en euros, et l'URSSAF exige une déclaration en euros. Ne les déclarez pas tels quels. Pour corriger : dans les réglages Shopify (Réglages > Général > Devise de la boutique), passez la devise en EUR — les nouvelles ventes seront alors correctement comptées ici. Ce changement ne convertit pas les ventes déjà passées en ${deviseBoutique} : pour celles-ci, calculez vous-même leur équivalent en euros au taux de change du jour de l'encaissement avant de les déclarer.`}
          />
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

      {totaux.caPeriodeCourante === 0 && (
        <s-banner tone="info">
          <s-paragraph>
            Aucun encaissement sur cette période. Une déclaration à 0 € reste
            obligatoire auprès de l&apos;URSSAF.
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading="Jauge du plafond annuel">
        <s-stack direction="block" gap="base">
          <div style={{ position: "relative", height: "16px", width: "100%", background: "var(--piste-jauge)", borderRadius: "8px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pourcentagePlafond}%`,
                background: COULEUR_ALERTE[totaux.niveauAlerte],
                borderRadius: "8px",
                transition: "width 0.3s ease",
              }}
            />
            <div style={{ position: "absolute", left: `${pourcentageAvertissement}%`, top: 0, bottom: 0, width: "2px", background: "var(--repere-jauge)" }} />
            <div style={{ position: "absolute", left: `${pourcentageCritique}%`, top: 0, bottom: 0, width: "2px", background: "var(--repere-jauge)" }} />
          </div>
          {/* 2 éléments alignés sur les bornes de la jauge (0 € à gauche, plafond à droite) plutôt
              que 3 en une seule ligne : sur un écran étroit, 3 éléments "space-between" ne tiennent
              pas et le dernier se retrouve seul sur une 2e ligne, décroché du bord droit de la barre
              qu'il est censé légender. */}
          <s-stack direction="inline" justifyContent="space-between">
            <s-text color="subdued">0 €</s-text>
            <s-text color="subdued">{formateurEUR.format(plafond)}</s-text>
          </s-stack>
          <s-text color="subdued">Seuils d&apos;alerte : {pourcentageAvertissement} % et {pourcentageCritique} %</s-text>
          {dateProjeteePlafond && (
            <s-text color="subdued">
              Au rythme actuel, vous atteindriez le plafond vers le {formateurDate.format(new Date(dateProjeteePlafond))}.
            </s-text>
          )}
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
                Vous approchez du plafond annuel ({pourcentageAvertissement} %). Le dépasser peut remettre
                en cause votre régime micro-entrepreneur : anticipez avec un
                expert-comptable si vous pensez le dépasser cette année.
              </s-paragraph>
              {/* secondary-actions plutôt que primary-action : ce lien est un complément
                  d'information (le site de l'URSSAF), pas l'action attendue du marchand
                  (plutôt contacter un expert-comptable, qui n'a pas de bouton) — un bouton
                  plein ici ajouterait de l'urgence visuelle sans raison, alors que le ton
                  de la bannière suffit déjà à alerter. */}
              <s-button slot="secondary-actions" variant="secondary" href="https://www.autoentrepreneur.urssaf.fr" target="_blank">
                Voir le site de l&apos;URSSAF
              </s-button>
            </s-banner>
          )}
          {totaux.niveauAlerte === "critique" && (
            <s-banner tone="critical">
              <s-paragraph>
                Attention, vous dépassez {pourcentageCritique} % du plafond annuel. Rapprochez-vous d&apos;un
                expert-comptable ou de l&apos;URSSAF rapidement.
              </s-paragraph>
              <s-button slot="secondary-actions" variant="secondary" href="https://www.autoentrepreneur.urssaf.fr" target="_blank">
                Voir le site de l&apos;URSSAF
              </s-button>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Évolution du CA encaissé">
        {comparaisonAnnuelle.variationPourcent !== null && (
          <s-stack direction="inline" gap="small-200" alignItems="center">
            {/* Ton neutre volontaire : ce badge compare le rythme d'encaissement à l'an
                dernier, une donnée indépendante du niveau d'alerte plafond (totaux.niveauAlerte,
                qui a lui sa propre couleur plus haut dans la jauge). Un badge vert/jaune ici
                créerait un signal contradictoire si la jauge est par ailleurs en orange/rouge. */}
            <s-badge tone="neutral">
              {comparaisonAnnuelle.variationPourcent >= 0 ? "+" : ""}
              {comparaisonAnnuelle.variationPourcent} %
            </s-badge>
            <s-text color="subdued">
              vs l&apos;an dernier à la même date ({formateurEUR.format(comparaisonAnnuelle.caAnneePrecedente)})
            </s-text>
          </s-stack>
        )}
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
                    background: estMoisCourant ? COULEUR_ALERTE.ok : "var(--barre-graphique-passee)",
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

      {doitRappelerExport && <BanniereExport />}

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
