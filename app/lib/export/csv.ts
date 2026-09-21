import type { LigneLivreDesRecettes } from "../domain/types";
import { LIBELLES_NATURE, libelleCanal, libelleModeReglement } from "../domain/livreDesRecettes";

const EN_TETES = ["Date", "Référence", "Client", "Nature", "Mode de règlement", "Canal", "Montant"];

// Format numérique (JJ/MM/AAAA), pas le format texte de lib/ui/formateurs.ts : un
// tableur (Excel, Google Sheets) reconnaît et trie ce format automatiquement comme
// une date, contrairement à "20 sept. 2026". timeZone explicite pour la même raison
// que partout ailleurs (cf. lib/domain/fuseauParis.ts) : sans ça, une vente encaissée
// juste après minuit heure de Paris s'exporterait avec la date de la veille.
const formateurDateCSV = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" });

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
      formateurDateCSV.format(new Date(ligne.date)),
      ligne.reference,
      ligne.client,
      LIBELLES_NATURE[ligne.nature],
      libelleModeReglement(ligne.modeReglement),
      libelleCanal(ligne.canal),
      ligne.montant.toFixed(2).replace(".", ","),
    ]
      .map(echapperChampCSV)
      .join(";"),
  );

  return ["﻿" + entetes, ...corps].join("\r\n");
}
