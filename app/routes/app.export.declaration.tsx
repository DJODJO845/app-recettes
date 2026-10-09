import type { LoaderFunctionArgs } from "react-router";
import { authenticateAdmin } from "../shopify.server";
import { obtenirOuCreerBoutique, enregistrerExportation } from "../lib/db/boutique.server";
import { listerLignes } from "../lib/db/lignesLivre.server";
import { calculerCAPeriode } from "../lib/domain/livreDesRecettes";
import { decalagePeriodeDepuisParam, periodeDecalee } from "../lib/domain/periode";
import { formateurEUR, formateurDate } from "../lib/ui/formateurs";
import { echapperHTML } from "../lib/ui/html";

const LIBELLE_TYPE_ACTIVITE = { COMMERCE: "Commerce", SERVICES: "Services", MIXTE: "Mixte" } as const;

/**
 * Fiche d'une seule période de déclaration (le montant exact à recopier dans la
 * déclaration URSSAF en ligne), plutôt que le livre complet de app.export.imprimer —
 * ce dernier sert à l'archivage légal (10 ans), celui-ci sert au geste ponctuel de
 * déclarer. `periode` dans l'URL : 0 = période en cours, -1 = précédente, etc. — on
 * déclare normalement la période qui vient de se terminer, donc -1 par défaut.
 *
 * Pas de navigation (précédente/suivante) sur CETTE page : elle s'ouvre dans un
 * nouvel onglet hors iframe, authentifié par un `id_token` à usage unique dans l'URL
 * (cf. urlAutorisee dans app.export.tsx) — un lien interne perdrait ce jeton et
 * échouerait à l'authentification au clic suivant. La navigation entre périodes se
 * fait donc sur /app/export (dans l'app embarquée, session normale), avant d'ouvrir
 * cet onglet avec un jeton frais pour la période choisie.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request);
  const boutique = await obtenirOuCreerBoutique(session.shop);

  const url = new URL(request.url);
  const decalage = decalagePeriodeDepuisParam(url.searchParams.get("periode"));

  const periode = periodeDecalee(boutique.periodicite, decalage, new Date());
  const lignes = await listerLignes(session.shop, { debut: periode.debut, fin: periode.fin });
  const caADeclarer = calculerCAPeriode(lignes, periode.debut, periode.fin);

  await enregistrerExportation(session.shop);

  const periodeEnCours = decalage === 0;
  const typeActiviteLabel = LIBELLE_TYPE_ACTIVITE[boutique.typeActivite];

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  <title>Déclaration URSSAF — ${echapperHTML(periode.label)}</title>
  <style>
    /* Couleurs explicites : sans ça, le mode sombre forcé de certains navigateurs
       mobiles peut rendre le texte invisible sur une page qui ne déclare que des
       styles "clairs" implicites (même technique que app.export.imprimer.tsx). */
    html { background: #ffffff !important; color-scheme: light; }
    * { color: #1a1a1a !important; box-sizing: border-box; }
    html, body { background: #ffffff !important; }
    body { font-family: sans-serif; margin: 0; }
    .entete { background: #0E6B5C !important; padding: 24px 32px; }
    .entete h1 { margin: 0 0 4px 0; font-size: 20px; color: #ffffff !important; }
    .entete p { margin: 0; font-size: 13px; color: #CFE6DE !important; }
    .contenu { padding: 24px 32px; max-width: 480px; }
    .actions { margin-bottom: 20px; }
    .actions button {
      display: inline-block; background: #0E6B5C !important; color: #ffffff !important; border: none;
      padding: 10px 20px; border-radius: 6px; font-size: 14px; cursor: pointer;
    }
    .montant {
      margin: 24px 0; padding: 20px 24px; background: #F3F7F5 !important; border-radius: 12px;
      text-align: center;
    }
    .montant .valeur { font-size: 36px; font-weight: 700; color: #0E6B5C !important; }
    .montant .legende { font-size: 13px; color: #555 !important; margin-top: 4px; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; font-size: 14px; margin: 24px 0; }
    dt { color: #555 !important; }
    dd { margin: 0; font-weight: 600; }
    .avertissement {
      margin: 16px 0; padding: 12px 16px; background: #FCF1D8 !important; border-radius: 8px; font-size: 13px;
    }
    .mentions { margin-top: 24px; font-size: 11px; color: #666 !important; }
    @media print { .actions { display: none; } .entete { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .montant { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="entete">
    <h1>Déclaration URSSAF — ${echapperHTML(periode.label)}</h1>
    <p>${echapperHTML(session.shop)} — document généré le ${formateurDate.format(new Date())}</p>
  </div>
  <div class="contenu">
    <div class="actions">
      <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
    </div>

    ${periodeEnCours ? `<div class="avertissement">Cette période n'est pas encore terminée : ce montant évoluera encore jusqu'à la fin de la période.</div>` : ""}

    <div class="montant">
      <div class="valeur">${formateurEUR.format(caADeclarer)}</div>
      <div class="legende">CA encaissé à déclarer pour ${echapperHTML(periode.label)}</div>
    </div>

    <dl>
      <dt>Période</dt><dd>du ${formateurDate.format(periode.debut)} au ${formateurDate.format(periode.fin)}</dd>
      <dt>Type d'activité</dt><dd>${typeActiviteLabel}</dd>
    </dl>

    ${
      boutique.typeActivite === "MIXTE"
        ? `<div class="avertissement">Activité mixte : ce montant est le CA global. L'app ne distingue pas automatiquement la part « services » de la part « commerce » — reportez-vous au livre des recettes ou à votre expert-comptable pour ventiler les deux si votre déclaration le demande.</div>`
        : ""
    }

    <p class="mentions">Cette app est une aide, elle ne remplace pas un expert-comptable. Vérifiez ce montant avant de le reporter sur <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" style="color:#0E6B5C !important;">autoentrepreneur.urssaf.fr</a>.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
