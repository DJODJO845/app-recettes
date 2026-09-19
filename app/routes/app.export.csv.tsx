import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { listerLignes } from "../lib/db/lignesLivre.server";
import { genererCSV } from "../lib/export/csv";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const lignes = await listerLignes(session.shop);
  const csv = genererCSV(lignes);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="livre-des-recettes.csv"`,
    },
  });
};
