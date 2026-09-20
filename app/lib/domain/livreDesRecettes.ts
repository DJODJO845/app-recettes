import type {
  CommandeShopify,
  LigneLivreDesRecettes,
  NatureLigneLivre,
  TransactionShopify,
} from "./types";

/** Libellés français de `NatureLigneLivre`, partagés entre l'affichage (Livre), le CSV et le PDF imprimable. */
export const LIBELLES_NATURE: Record<NatureLigneLivre, string> = {
  vente: "Vente",
  vente_carte_cadeau: "Vente de carte cadeau",
  reglement_carte_cadeau: "Règlement par carte cadeau",
  remboursement: "Remboursement",
};

const LIBELLES_MODE_REGLEMENT: Record<string, string> = {
  manual: "Virement ou carte bancaire (paiement manuel)",
  gift_card: "Carte cadeau",
  shopify_payments: "Carte bancaire",
  cash: "Espèces (point de vente)",
  paypal: "PayPal",
  alma: "Paiement en plusieurs fois (Alma)",
  klarna: "Paiement en plusieurs fois (Klarna)",
  bogus: "Paiement test (boutique de démonstration)",
};

/**
 * Anciens libellés déjà enregistrés en base par une version précédente de la table
 * ci-dessus, à rediriger vers le libellé actuel (une ligne n'est jamais modifiée après
 * création — voir `libelleModeReglement`). Ajouter une entrée ici à chaque fois qu'un
 * libellé change, pour que les anciennes et les nouvelles lignes restent regroupées.
 */
const ANCIENS_LIBELLES_MODE_REGLEMENT: Record<string, string> = {
  "Virement / espèces (paiement manuel)": "Virement ou carte bancaire (paiement manuel)",
};

/**
 * Traduit un identifiant de gateway Shopify (ex. "cash") ou un libellé déjà stocké
 * en base en libellé affichable. Comme une ligne du livre n'est jamais modifiée après
 * création, d'anciennes lignes peuvent contenir un identifiant brut enregistré avant
 * qu'il ne soit ajouté à `LIBELLES_MODE_REGLEMENT` (ex. "cash" avant son ajout), ou un
 * ancien libellé remplacé depuis (voir `ANCIENS_LIBELLES_MODE_REGLEMENT`) : cette
 * fonction est donc aussi appelée à l'affichage sur les valeurs déjà stockées, pour que
 * les anciennes et nouvelles lignes du même mode de règlement partagent le même libellé.
 * Un libellé déjà à jour n'est une clé d'aucune des deux tables, donc il ressort
 * inchangé : l'opération est sans effet si elle est appliquée plusieurs fois.
 */
export function libelleModeReglement(valeurStockee: string): string {
  return (
    LIBELLES_MODE_REGLEMENT[valeurStockee] ??
    ANCIENS_LIBELLES_MODE_REGLEMENT[valeurStockee] ??
    valeurStockee
  );
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
