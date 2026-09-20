import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { listerLignes } from "../lib/db/lignesLivre.server";
import { LIBELLES_NATURE, libelleModeReglement } from "../lib/domain/livreDesRecettes";

const formateurEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const formateurDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const lignes = await listerLignes(session.shop);

  const caEncaisse = lignes
    .filter((ligne) => ligne.compteDansCA)
    .reduce((total, ligne) => total + ligne.montant, 0);

  const lignesHTML = lignes
    .map(
      (ligne) => `
        <tr>
          <td>${formateurDate.format(new Date(ligne.date))}</td>
          <td>${ligne.reference}</td>
          <td>${ligne.client}</td>
          <td>${LIBELLES_NATURE[ligne.nature]}</td>
          <td>${libelleModeReglement(ligne.modeReglement)}</td>
          <td style="text-align:right">${formateurEUR.format(ligne.montant)}</td>
        </tr>
      `,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  <title>Livre des recettes — ${session.shop}</title>
  <style>
    /* Couleurs explicites : sans ça, le mode sombre forcé de certains
       navigateurs mobiles peut rendre le texte invisible (même couleur
       que le fond) sur une page qui ne déclare que des styles "clairs"
       implicites. */
    html { background: #ffffff !important; color-scheme: light; }
    * { color: #1a1a1a !important; box-sizing: border-box; }
    html, body { background: #ffffff !important; }
    body { font-family: sans-serif; margin: 0; }
    .entete { background: #0E6B5C !important; padding: 24px 32px; }
    /* Le sélecteur universel * force color:#1a1a1a sur CHAQUE élément (nécessaire
       contre le mode sombre forcé, cf. commentaire plus haut) : l'héritage seul ne
       suffit pas ici, donc h1/p à l'intérieur du bandeau ont besoin de leur propre
       règle explicite pour rester lisibles sur le fond teal. */
    .entete h1 { margin: 0 0 4px 0; font-size: 20px; color: #ffffff !important; }
    .entete p { margin: 0; font-size: 13px; color: #CFE6DE !important; }
    .contenu { padding: 24px 32px; }
    .resume { display: flex; gap: 32px; margin-bottom: 20px; padding: 12px 16px; background: #F3F7F5 !important; border-radius: 8px; }
    .resume strong { display: block; font-size: 16px; }
    .resume span { font-size: 12px; color: #555 !important; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #ccc !important; background-color: transparent !important; padding: 6px 8px; text-align: left; font-size: 12px; }
    th { border-bottom: 2px solid #1a1a1a !important; }
    tfoot td { border-bottom: none !important; border-top: 2px solid #1a1a1a !important; font-weight: bold; padding-top: 10px; }
    .mentions { margin-top: 24px; font-size: 11px; color: #666 !important; }
    button { background: #0E6B5C !important; color: #ffffff !important; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; cursor: pointer; }
    @media print { button { display: none; } .entete { background: #0E6B5C !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="entete">
    <h1>Livre des recettes — ${session.shop}</h1>
    <p>Document généré le ${formateurDate.format(new Date())} avec Recettes URSSAF</p>
  </div>
  <div class="contenu">
    <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
    <div class="resume">
      <div><strong>${lignes.length}</strong><span>ligne(s)</span></div>
      <div><strong>${formateurEUR.format(caEncaisse)}</strong><span>CA encaissé total</span></div>
    </div>
    <table>
      <thead>
        <tr><th>Date</th><th>Référence</th><th>Client</th><th>Nature</th><th>Mode de règlement</th><th>Montant</th></tr>
      </thead>
      <tbody>${lignesHTML}</tbody>
      <tfoot>
        <tr><td colspan="5">CA encaissé total</td><td style="text-align:right">${formateurEUR.format(caEncaisse)}</td></tr>
      </tfoot>
    </table>
    <p class="mentions">Cette app est une aide, elle ne remplace pas un expert-comptable. Conservation légale : 10 ans.</p>
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
