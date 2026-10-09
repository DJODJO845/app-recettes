import { describe, expect, it } from "vitest";
import { calculerCAPeriode, commandeEstDansPerimetre, construireLignesLivre, libelleCanal } from "../livreDesRecettes";
import { niveauAlertePlafond, plafondAnnuel } from "../reglementation";
import type { CommandeShopify } from "../types";

function commande(partiel: Partial<CommandeShopify> & Pick<CommandeShopify, "id" | "name" | "transactions">): CommandeShopify {
  return {
    sourceName: "web",
    nomClient: "Camille Dupont",
    estVenteDeCarteCadeau: false,
    ...partiel,
  };
}

describe("construireLignesLivre — paiement carte classique", () => {
  it("crée une ligne 'vente' positive à la date d'encaissement, sans avertissement", () => {
    const cmd = commande({
      id: "gid://1",
      name: "#1001",
      transactions: [
        { id: "txn-1", orderId: "gid://1", kind: "sale", status: "success", amount: 49.9, gateway: "shopify_payments", processedAt: "2026-03-05T10:00:00Z" },
      ],
    });

    const lignes = construireLignesLivre(cmd);

    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      nature: "vente",
      montant: 49.9,
      compteDansCA: true,
      date: "2026-03-05T10:00:00Z",
    });
    expect(lignes[0]?.avertissement).toBeUndefined();
  });

  it("ignore les transactions échouées ou en attente : aucun argent n'est entré", () => {
    const cmd = commande({
      id: "gid://2",
      name: "#1002",
      transactions: [
        { id: "txn-2a", orderId: "gid://2", kind: "sale", status: "failure", amount: 30, gateway: "shopify_payments", processedAt: "2026-03-06T09:00:00Z" },
        { id: "txn-2b", orderId: "gid://2", kind: "authorization", status: "success", amount: 30, gateway: "shopify_payments", processedAt: "2026-03-06T09:00:01Z" },
      ],
    });

    expect(construireLignesLivre(cmd)).toHaveLength(0);
  });
});

describe("construireLignesLivre — remboursement partiel", () => {
  it("crée une ligne négative à la date du remboursement, sans toucher à la ligne d'origine", () => {
    const cmd = commande({
      id: "gid://3",
      name: "#1003",
      transactions: [
        { id: "txn-3-vente", orderId: "gid://3", kind: "sale", status: "success", amount: 120, gateway: "shopify_payments", processedAt: "2026-03-10T08:00:00Z" },
        { id: "txn-3-remb", orderId: "gid://3", kind: "refund", status: "success", amount: 40, gateway: "shopify_payments", processedAt: "2026-04-02T14:00:00Z" },
      ],
    });

    const lignes = construireLignesLivre(cmd);

    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({ nature: "vente", montant: 120 });
    expect(lignes[1]).toMatchObject({
      nature: "remboursement",
      montant: -40,
      date: "2026-04-02T14:00:00Z",
      compteDansCA: true,
    });

    // Le remboursement est sur une autre période que la vente : chacun compte sur sa propre période.
    const caMars = calculerCAPeriode(lignes, new Date("2026-03-01"), new Date("2026-03-31T23:59:59Z"));
    const caAvril = calculerCAPeriode(lignes, new Date("2026-04-01"), new Date("2026-04-30T23:59:59Z"));
    expect(caMars).toBe(120);
    expect(caAvril).toBe(-40);
  });
});

describe("construireLignesLivre — carte cadeau (émission vs rédemption)", () => {
  it("compte la vente de la carte cadeau, mais pas son utilisation ultérieure (pas de double comptage)", () => {
    const venteDeCarte = commande({
      id: "gid://4",
      name: "#1004",
      estVenteDeCarteCadeau: true,
      transactions: [
        { id: "txn-4", orderId: "gid://4", kind: "sale", status: "success", amount: 50, gateway: "shopify_payments", processedAt: "2026-01-15T10:00:00Z" },
      ],
    });

    const commandeRegleeParCarte = commande({
      id: "gid://5",
      name: "#1005",
      transactions: [
        { id: "txn-5", orderId: "gid://5", kind: "sale", status: "success", amount: 50, gateway: "gift_card", processedAt: "2026-02-20T10:00:00Z" },
      ],
    });

    const lignesVente = construireLignesLivre(venteDeCarte);
    const lignesReglement = construireLignesLivre(commandeRegleeParCarte);

    expect(lignesVente[0]).toMatchObject({ nature: "vente_carte_cadeau", montant: 50, compteDansCA: true });
    expect(lignesReglement[0]).toMatchObject({ nature: "reglement_carte_cadeau", montant: 50, compteDansCA: false });

    const toutesLesLignes = [...lignesVente, ...lignesReglement];
    const caAnnee = calculerCAPeriode(toutesLesLignes, new Date("2026-01-01"), new Date("2026-12-31T23:59:59Z"));
    // Un seul encaissement réel de 50 € (à la vente de la carte), pas 100 €.
    expect(caAnnee).toBe(50);
  });
});

describe("construireLignesLivre — remboursement émis en avoir/carte cadeau", () => {
  it("ne réduit pas le CA : aucun argent réel ne sort du compte du marchand", () => {
    const cmd = commande({
      id: "gid://9",
      name: "#1009",
      transactions: [
        { id: "txn-9-vente", orderId: "gid://9", kind: "sale", status: "success", amount: 80, gateway: "shopify_payments", processedAt: "2026-05-10T08:00:00Z" },
        // Le marchand rembourse sous forme d'avoir (carte cadeau) plutôt que de rendre
        // l'argent sur la carte d'origine : Shopify crédite juste une carte cadeau,
        // aucun argent ne sort réellement du compte du marchand.
        { id: "txn-9-remb", orderId: "gid://9", kind: "refund", status: "success", amount: 80, gateway: "gift_card", processedAt: "2026-05-12T09:00:00Z" },
      ],
    });

    const lignes = construireLignesLivre(cmd);

    expect(lignes).toHaveLength(2);
    expect(lignes[1]).toMatchObject({ nature: "remboursement", montant: -80, compteDansCA: false });

    const ca = calculerCAPeriode(lignes, new Date("2026-05-01"), new Date("2026-05-31T23:59:59Z"));
    expect(ca).toBe(80);
  });
});

describe("construireLignesLivre — paiement manuel (virement, espèces)", () => {
  it("compte l'encaissement mais ajoute un avertissement de vérification de la date", () => {
    const cmd = commande({
      id: "gid://6",
      name: "#1006",
      transactions: [
        { id: "txn-6", orderId: "gid://6", kind: "sale", status: "success", amount: 200, gateway: "manual", processedAt: "2026-05-01T00:00:00Z" },
      ],
    });

    const lignes = construireLignesLivre(cmd);

    expect(lignes[0]).toMatchObject({ nature: "vente", montant: 200, compteDansCA: true });
    expect(lignes[0]?.avertissement).toMatch(/vérifiez/i);
  });
});

describe("construireLignesLivre — paiement échelonné tiers (BNPL : Alma, Klarna)", () => {
  it("compte le montant total encaissé en une fois, à la date où le prestataire tiers a réglé le marchand", () => {
    const cmd = commande({
      id: "gid://7",
      name: "#1007",
      transactions: [
        { id: "txn-7", orderId: "gid://7", kind: "sale", status: "success", amount: 300, gateway: "alma", processedAt: "2026-06-01T12:00:00Z" },
      ],
    });

    const lignes = construireLignesLivre(cmd);

    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ montant: 300, compteDansCA: true, modeReglement: "Paiement en plusieurs fois (Alma)" });
  });
});

describe("construireLignesLivre — vente via Shopify POS", () => {
  it("applique la même règle d'encaissement qu'en ligne, le canal est juste informatif", () => {
    const cmd = commande({
      id: "gid://8",
      name: "#1008",
      sourceName: "pos",
      transactions: [
        { id: "txn-8", orderId: "gid://8", kind: "sale", status: "success", amount: 75, gateway: "shopify_payments", processedAt: "2026-06-10T15:00:00Z" },
      ],
    });

    const lignes = construireLignesLivre(cmd);

    expect(lignes[0]).toMatchObject({ montant: 75, compteDansCA: true, canal: "pos" });
  });
});

describe("commandeEstDansPerimetre", () => {
  it("écarte une commande entière (vente + remboursement) vendue avant le plancher", () => {
    const cmd = commande({
      id: "gid://10",
      name: "#1010",
      transactions: [
        { id: "txn-10-vente", orderId: "gid://10", kind: "sale", status: "success", amount: 60, gateway: "shopify_payments", processedAt: "2026-01-05T10:00:00Z" },
        { id: "txn-10-remb", orderId: "gid://10", kind: "refund", status: "success", amount: 60, gateway: "shopify_payments", processedAt: "2026-07-01T10:00:00Z" },
      ],
    });

    // dateDebutActivite déclarée après la vente d'origine, mais avant le remboursement :
    // toute la commande doit être écartée, pas seulement la ligne de vente — sinon le
    // remboursement apparaîtrait seul, sans vente correspondante dans le livre.
    expect(commandeEstDansPerimetre(cmd, new Date("2026-03-01T00:00:00Z"))).toBe(false);
  });

  it("garde une commande dont la vente d'origine est après le plancher", () => {
    const cmd = commande({
      id: "gid://11",
      name: "#1011",
      transactions: [
        { id: "txn-11-vente", orderId: "gid://11", kind: "sale", status: "success", amount: 60, gateway: "shopify_payments", processedAt: "2026-04-05T10:00:00Z" },
      ],
    });

    expect(commandeEstDansPerimetre(cmd, new Date("2026-03-01T00:00:00Z"))).toBe(true);
  });

  it("le filtre commande + ligne combinés n'introduisent aucun remboursement orphelin", () => {
    const venteHorsPerimetre = commande({
      id: "gid://12",
      name: "#1012",
      transactions: [
        { id: "txn-12-vente", orderId: "gid://12", kind: "sale", status: "success", amount: 60, gateway: "shopify_payments", processedAt: "2026-01-05T10:00:00Z" },
        { id: "txn-12-remb", orderId: "gid://12", kind: "refund", status: "success", amount: 60, gateway: "shopify_payments", processedAt: "2026-07-01T10:00:00Z" },
      ],
    });

    const plancher = new Date("2026-03-01T00:00:00Z");
    const lignes = commandeEstDansPerimetre(venteHorsPerimetre, plancher)
      ? construireLignesLivre(venteHorsPerimetre)
      : [];

    expect(lignes).toHaveLength(0);
  });
});

describe("libelleCanal", () => {
  it("traduit les canaux de vente Shopify connus en français", () => {
    expect(libelleCanal("web")).toBe("Boutique en ligne");
    expect(libelleCanal("quick_sale")).toBe("Point de vente (vente rapide)");
    expect(libelleCanal("shopify_draft_order")).toBe("Commande brouillon");
  });

  it("laisse inchangée une valeur non répertoriée plutôt que de planter", () => {
    expect(libelleCanal("un_canal_inconnu")).toBe("un_canal_inconnu");
  });
});

describe("plafond annuel et jauge d'alerte", () => {
  it("passe en 'avertissement' à 80% du plafond commerce et 'critique' à 95%", () => {
    const plafondCommerce = plafondAnnuel("commerce");

    expect(niveauAlertePlafond(plafondCommerce * 0.5, "commerce")).toBe("ok");
    expect(niveauAlertePlafond(plafondCommerce * 0.8, "commerce")).toBe("avertissement");
    expect(niveauAlertePlafond(plafondCommerce * 0.95, "commerce")).toBe("critique");
  });
});
