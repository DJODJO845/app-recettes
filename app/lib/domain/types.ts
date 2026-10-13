// Types représentant le sous-ensemble des données Shopify (Order + Transactions)
// dont le moteur du livre des recettes a besoin. Volontairement minimal : on ne
// modélise que ce qui influence une ligne du livre, pas toute l'API Shopify.

export type NatureTransactionShopify =
  | "sale"
  | "capture"
  | "refund"
  | "void"
  | "authorization";

export type StatutTransactionShopify = "success" | "pending" | "failure" | "error";

export interface TransactionShopify {
  id: string;
  orderId: string;
  kind: NatureTransactionShopify;
  status: StatutTransactionShopify;
  /** Montant absolu de la transaction, toujours positif ; le signe est décidé par `kind`. */
  amount: number;
  /** Identifiant de la passerelle Shopify : "manual", "gift_card", "alma", "klarna", "shopify_payments", etc. */
  gateway: string;
  /** Date à laquelle Shopify considère la transaction traitée (créditée/remboursée). */
  processedAt: string;
}

export interface CommandeShopify {
  id: string;
  /** Numéro de commande affiché au marchand, ex. "#1042". */
  name: string;
  /** Canal d'origine de la vente : "web", "pos", ou autre canal connecté. */
  sourceName: string;
  /** Nom du client si l'accès aux protected customer data a été accordé, sinon undefined. */
  nomClient?: string;
  /**
   * Identifiant Shopify (GID) du client, ex. "gid://shopify/Customer/123". Sert à
   * retrouver ses lignes de façon fiable pour les webhooks RGPD — le nom affiché
   * seul n'est pas un identifiant sûr (deux clients peuvent porter le même nom).
   */
  clientId?: string;
  /** true si la commande porte sur une carte cadeau vendue (pas une commande réglée avec une carte cadeau). */
  estVenteDeCarteCadeau: boolean;
  transactions: TransactionShopify[];
  /** Articles de la commande, cartes cadeaux déjà exclues (voir mapperCommande) — pour les statistiques de ventes, pas le livre des recettes. */
  articles: ArticleLigneCommande[];
}

export interface ArticleLigneCommande {
  /** GID Shopify du lineItem, pour l'idempotence de l'import (voir ArticleVendu). */
  id: string;
  titre: string;
  titreVariante?: string;
  quantite: number;
  /** CA généré par cette ligne (quantité × prix unitaire, remise déduite), devise de la boutique. */
  montant: number;
}

export interface ArticleVenduDomaine {
  id: string;
  /** Date de la vente : celle de la première transaction de vente réussie de la commande (voir statistiquesProduits.ts). */
  date: string;
  titreProduit: string;
  titreVariante?: string;
  quantite: number;
  /** CA net (après remboursement éventuel) — utilisé pour "Meilleures ventes", jamais la source du CA déclaré à l'URSSAF. */
  montant: number;
  /** CA avant tout remboursement — sert uniquement à calculer un taux de remboursement par produit (voir obtenirTauxRemboursement), jamais à un autre usage. */
  montantBrut: number;
}

export type NatureLigneLivre =
  | "vente"
  | "vente_carte_cadeau"
  | "reglement_carte_cadeau"
  | "remboursement";

export interface LigneLivreDesRecettes {
  /** Identifiant stable de la ligne (dérivé de l'id de transaction Shopify), jamais réutilisé. */
  id: string;
  /** Date d'encaissement (ou de remboursement) — jamais la date de facturation. */
  date: string;
  /** Référence de commande, ex. "#1042". */
  reference: string;
  client: string;
  /** Voir `CommandeShopify.clientId`. */
  clientId?: string;
  nature: NatureLigneLivre;
  /** Positif pour un encaissement, négatif pour un remboursement. */
  montant: number;
  modeReglement: string;
  canal: string;
  /**
   * false uniquement pour le règlement par carte cadeau (l'argent est déjà entré en
   * compte lors de la vente de la carte) : la ligne existe pour la traçabilité mais ne
   * doit pas être comptée une deuxième fois dans le CA encaissé de la période.
   */
  compteDansCA: boolean;
  /** Présent quand la donnée nécessite une vérification humaine (ex. date de paiement manuel). */
  avertissement?: string;
}
