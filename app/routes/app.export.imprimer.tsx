import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { listerLignes } from "../lib/db/lignesLivre.server";

const formateurEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const formateurDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const lignes = await listerLignes(session.shop);

  const lignesHTML = lignes
    .map(
      (ligne) => `
        <tr>
          <td>${formateurDate.format(new Date(ligne.date))}</td>
          <td>${ligne.reference}</td>
          <td>${ligne.client}</td>
          <td>${ligne.nature}</td>
          <td>${ligne.modeReglement}</td>
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
    * { color: #1a1a1a !important; background-color: transparent !important; }
    html, body { background: #ffffff !important; }
    body { font-family: sans-serif; margin: 2rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #999 !important; padding: 4px 8px; text-align: left; font-size: 12px; }
    h1 { font-size: 18px; }
    button { background: #1a1a1a !important; color: #ffffff !important; border: none; padding: 8px 16px; border-radius: 4px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  <h1>Livre des recettes — ${session.shop}</h1>
  <p>Document généré le ${formateurDate.format(new Date())}. Cette app est une aide, elle ne remplace pas un expert-comptable.</p>
  <table>
    <thead>
      <tr><th>Date</th><th>Référence</th><th>Client</th><th>Nature</th><th>Mode de règlement</th><th>Montant</th></tr>
    </thead>
    <tbody>${lignesHTML}</tbody>
  </table>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
