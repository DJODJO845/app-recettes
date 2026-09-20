import type { LigneLivreDesRecettes } from "../domain/types";
import { LIBELLES_NATURE } from "../domain/livreDesRecettes";

const EN_TETES = ["Date", "Référence", "Client", "Nature", "Mode de règlement", "Canal", "Montant"];

function echapperChampCSV(valeur: string): string {
  if (/[;"\n]/.test(valeur)) {
    return `"${valeur.replace(/"/g, '""')}"`;
  }
  return valeur;
}

/**
 * Génère le CSV du livre des recettes. Colonnes conformes aux mentions obligatoires
 * par ligne (section 3 du cahier des charges) : date d'encaissement, référence,
 * client, nature de la vente, montant, mode de règlement.
 */
export function genererCSV(lignes: LigneLivreDesRecettes[]): string {
  const entetes = EN_TETES.join(";");
  const corps = lignes.map((ligne) =>
    [
      new Date(ligne.date).toLocaleDateString("fr-FR"),
      ligne.reference,
      ligne.client,
      LIBELLES_NATURE[ligne.nature],
      ligne.modeReglement,
      ligne.canal,
      ligne.montant.toFixed(2).replace(".", ","),
    ]
      .map(echapperChampCSV)
      .join(";"),
  );

  return ["﻿" + entetes, ...corps].join("\r\n");
}
