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

const LIBELLES_CANAL: Record<string, string> = {
  web: "Boutique en ligne",
  pos: "Point de vente",
  iphone: "Point de vente (iPhone)",
  android: "Point de vente (Android)",
  quick_sale: "Point de vente (vente rapide)",
  shopify_draft_order: "Commande brouillon",
  shopify_draft_order_invoice: "Commande brouillon (facture payée)",
};

/**
 * Traduit le `sourceName` brut renvoyé par Shopify (ex. "quick_sale",
 * "shopify_draft_order") en libellé affichable — jamais stocké traduit (`canal` en
 * base reste toujours la valeur brute Shopify), donc traduit uniquement à
 * l'affichage, comme `libelleModeReglement`. Une valeur inconnue (nouveau canal de
 * vente non répertorié) ressort inchangée plutôt que de faire planter l'affichage.
 */
export function libelleCanal(valeurStockee: string): string {
  return LIBELLES_CANAL[valeurStockee] ?? valeurStockee;
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
  const estViaCarteCadeau = transaction.gateway === "gift_card";
  const estReglementParCarteCadeau = !estRemboursement && estViaCarteCadeau;
  // Un remboursement émis sous forme d'avoir/carte cadeau (au lieu d'un vrai retour
  // d'argent sur le moyen de paiement d'origine) ne fait sortir aucun argent réel du
  // compte du marchand : Shopify crédite juste une carte cadeau en interne. Le
  // compter comme un encaissement négatif ferait baisser le CA déclaré à tort — pour
  // une vente déjà réglée en carte cadeau (jamais comptée dans le CA, voir
  // reglement_carte_cadeau) comme pour une vente réglée en argent réel (l'argent est
  // toujours dans le compte du marchand, seulement transformé en avoir dû au client).
  const estRemboursementParCarteCadeau = estRemboursement && estViaCarteCadeau;

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
    compteDansCA: !estReglementParCarteCadeau && !estRemboursementParCarteCadeau,
    avertissement,
  };
}

/**
 * Une commande est dans le périmètre de l'activité déclarée si sa vente d'origine
 * (transaction "sale"/"capture", jamais "refund") a eu lieu à ou après `plancher`
 * (= dateDebutActivite du marchand). Sert à écarter une commande ENTIÈREMENT —
 * vente ET remboursement compris — plutôt que de filtrer chaque ligne indépendamment :
 * une commande vendue avant le début d'activité déclaré, puis remboursée après (ex.
 * ventes de test avant l'inscription officielle en micro-entreprise, remboursées une
 * fois l'activité commencée), verrait sinon sa ligne de vente écartée (hors périmètre)
 * mais sa ligne de remboursement conservée (après le plancher) : un remboursement sans
 * vente correspondante dans le livre, qui ferait baisser à tort le CA déclaré de la
 * période où il tombe — alors que cette vente n'a jamais été comptée dans le CA pour
 * commencer. Si la commande n'a aucune transaction de vente (cas anormal), on la garde
 * par défaut : le filtre par ligne dans importerCommandesRecentes reste le filet de
 * sécurité final.
 */
export function commandeEstDansPerimetre(commande: CommandeShopify, plancher: Date): boolean {
  const datesVentes = commande.transactions
    .filter((transaction) => transaction.kind !== "refund")
    .map((transaction) => new Date(transaction.processedAt).getTime());

  if (datesVentes.length === 0) return true;
  return Math.min(...datesVentes) >= plancher.getTime();
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
