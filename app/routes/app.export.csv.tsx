import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { listerLignes } from "../lib/db/lignesLivre.server";
import { enregistrerExportation } from "../lib/db/boutique.server";
import { genererCSV } from "../lib/export/csv";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const lignes = await listerLignes(session.shop);
  const csv = genererCSV(lignes);
  await enregistrerExportation(session.shop);

  // Nom de fichier daté : un nom fixe ("livre-des-recettes.csv") s'écrase ou
  // s'accumule en "(1)", "(2)"... à chaque nouvel export, impossible à
  // distinguer — surtout gênant pour un fichier envoyé à un comptable.
  const nomBoutique = session.shop.replace(".myshopify.com", "");
  const date = new Date().toISOString().slice(0, 10);
  const nomFichier = `livre-des-recettes_${nomBoutique}_${date}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Cache-Control": "no-store",
    },
  });
};
