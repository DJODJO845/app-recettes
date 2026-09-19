import type {
  CommandeShopify,
  LigneLivreDesRecettes,
  NatureLigneLivre,
  TransactionShopify,
} from "./types";

const LIBELLES_MODE_REGLEMENT: Record<string, string> = {
  manual: "Virement / espèces (paiement manuel)",
  gift_card: "Carte cadeau",
  shopify_payments: "Carte bancaire",
  alma: "Paiement en plusieurs fois (Alma)",
  klarna: "Paiement en plusieurs fois (Klarna)",
};

function libelleModeReglement(gateway: string): string {
  return LIBELLES_MODE_REGLEMENT[gateway] ?? gateway;
}

/**
 * Construit les lignes du livre des recettes pour une commande Shopify, en appliquant
 * les règles CONFORMITÉ décidées en Phase 1 (docs/phase-1-verification.md, section B) :
 *  - seules les transactions "sale"/"capture"/"refund" au statut "success" produisent
 *    une ligne (les tentatives échouées ou en attente n'ont jamais fait entrer d'argent) ;
 *  - un règlement par carte cadeau n'est PAS un nouvel encaissement (l'argent est déjà
 *    entré lors de la vente de la carte cadeau) ;
 *  - un remboursement est une ligne négative à la date du remboursement, jamais une
 *    modification de la ligne d'origine ;
 *  - un paiement manuel est marqué d'un avertissement invitant le marchand à vérifier
 *    la date réelle de réception des fonds ;
 *  - le canal de vente (web, POS, autre) n'a aucun effet sur la règle d'encaissement.
 */
export function construireLignesLivre(commande: CommandeShopify): LigneLivreDesRecettes[] {
  const client = commande.nomClient ?? "Client";
  const lignes: LigneLivreDesRecettes[] = [];

  for (const transaction of commande.transactions) {
    if (transaction.status !== "success") continue;
    if (transaction.kind !== "sale" && transaction.kind !== "capture" && transaction.kind !== "refund") {
      continue;
    }

    lignes.push(construireLigne(commande, transaction, client));
  }

  return lignes;
}

function construireLigne(
  commande: CommandeShopify,
  transaction: TransactionShopify,
  client: string,
): LigneLivreDesRecettes {
  const estRemboursement = transaction.kind === "refund";
  const estReglementParCarteCadeau = !estRemboursement && transaction.gateway === "gift_card";

  let nature: NatureLigneLivre;
  if (estRemboursement) {
    nature = "remboursement";
  } else if (estReglementParCarteCadeau) {
    nature = "reglement_carte_cadeau";
  } else if (commande.estVenteDeCarteCadeau) {
    nature = "vente_carte_cadeau";
  } else {
    nature = "vente";
  }

  const montant = estRemboursement ? -transaction.amount : transaction.amount;

  let avertissement: string | undefined;
  if (!estRemboursement && transaction.gateway === "manual") {
    avertissement =
      "Paiement manuel : vérifiez que cette date correspond bien à la réception réelle des fonds. " +
      "Si ce n'est pas le cas, corrigez par une nouvelle ligne, ne modifiez jamais celle-ci.";
  }

  return {
    id: transaction.id,
    date: transaction.processedAt,
    reference: commande.name,
    client,
    clientId: commande.clientId,
    nature,
    montant,
    modeReglement: libelleModeReglement(transaction.gateway),
    canal: commande.sourceName,
    compteDansCA: !estReglementParCarteCadeau,
    avertissement,
  };
}

/** Somme des lignes qui comptent dans le CA encaissé, sur une période donnée (bornes incluses). */
export function calculerCAPeriode(
  lignes: LigneLivreDesRecettes[],
  debut: Date,
  fin: Date,
): number {
  return lignes
    .filter((ligne) => ligne.compteDansCA)
    .filter((ligne) => {
      const date = new Date(ligne.date);
      return date >= debut && date <= fin;
    })
    .reduce((total, ligne) => total + ligne.montant, 0);
}
