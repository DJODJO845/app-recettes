import { describe, expect, it } from "vitest";
import { construireArticlesVendus } from "../statistiquesProduits";
import type { CommandeShopify } from "../types";

function commande(partiel: Partial<CommandeShopify> & Pick<CommandeShopify, "id" | "name" | "transactions" | "articles">): CommandeShopify {
  return {
    sourceName: "web",
    nomClient: "Camille Dupont",
    estVenteDeCarteCadeau: false,
    ...partiel,
  };
}

describe("construireArticlesVendus", () => {
  it("attribue le montant exact du produit quand il n'y a ni frais ni remise ni remboursement", () => {
    const cmd = commande({
      id: "gid://1",
      name: "#1001",
      transactions: [
        { id: "txn-1", orderId: "gid://1", kind: "sale", status: "success", amount: 100, gateway: "shopify_payments", processedAt: "2026-03-05T10:00:00Z" },
      ],
      articles: [{ id: "li-1", titre: "Produit A", quantite: 1, montant: 100 }],
    });

    const resultat = construireArticlesVendus(cmd);

    expect(resultat.articles).toHaveLength(1);
    expect(resultat.articles[0]).toMatchObject({ titreProduit: "Produit A", montant: 100, montantBrut: 100, date: "2026-03-05T10:00:00Z" });
    expect(resultat.idsLigneCommande).toEqual(["li-1"]);
  });

  it("répartit le CA net au prorata quand la commande encaisse plus que le prix des produits (frais de port)", () => {
    const cmd = commande({
      id: "gid://2",
      name: "#1002",
      transactions: [
        { id: "txn-2", orderId: "gid://2", kind: "sale", status: "success", amount: 130, gateway: "shopify_payments", processedAt: "2026-03-05T10:00:00Z" },
      ],
      articles: [
        { id: "li-2a", titre: "Produit A", quantite: 1, montant: 80 },
        { id: "li-2b", titre: "Produit B", quantite: 1, montant: 20 },
      ],
    });

    const resultat = construireArticlesVendus(cmd);
    const total = resultat.articles.reduce((somme, a) => somme + a.montant, 0);

    // facteur = 130 / 100 = 1.3
    const produitA = resultat.articles.find((a) => a.titreProduit === "Produit A");
    expect(produitA?.montant).toBeCloseTo(104, 5);
    expect(produitA?.montantBrut).toBe(80);
    expect(resultat.articles.find((a) => a.titreProduit === "Produit B")?.montant).toBeCloseTo(26, 5);
    expect(total).toBeCloseTo(130, 5);
  });

  it("ramène le montant net à 0 (mais garde montantBrut) quand la commande est intégralement remboursée", () => {
    const cmd = commande({
      id: "gid://3",
      name: "#1003",
      transactions: [
        { id: "txn-3a", orderId: "gid://3", kind: "sale", status: "success", amount: 50, gateway: "shopify_payments", processedAt: "2026-03-05T10:00:00Z" },
        { id: "txn-3b", orderId: "gid://3", kind: "refund", status: "success", amount: 50, gateway: "shopify_payments", processedAt: "2026-03-06T10:00:00Z" },
      ],
      articles: [{ id: "li-3", titre: "Produit A", quantite: 1, montant: 50 }],
    });

    const resultat = construireArticlesVendus(cmd);

    expect(resultat.articles).toHaveLength(1);
    expect(resultat.articles[0]).toMatchObject({ montant: 0, montantBrut: 50 });
    expect(resultat.idsLigneCommande).toEqual(["li-3"]);
  });

  it("réduit proportionnellement le montant net attribué en cas de remboursement partiel, sans toucher montantBrut", () => {
    const cmd = commande({
      id: "gid://4",
      name: "#1004",
      transactions: [
        { id: "txn-4a", orderId: "gid://4", kind: "sale", status: "success", amount: 100, gateway: "shopify_payments", processedAt: "2026-03-05T10:00:00Z" },
        { id: "txn-4b", orderId: "gid://4", kind: "refund", status: "success", amount: 40, gateway: "shopify_payments", processedAt: "2026-03-06T10:00:00Z" },
      ],
      articles: [
        { id: "li-4a", titre: "Produit A", quantite: 1, montant: 60 },
        { id: "li-4b", titre: "Produit B", quantite: 1, montant: 40 },
      ],
    });

    const resultat = construireArticlesVendus(cmd);
    const total = resultat.articles.reduce((somme, a) => somme + a.montant, 0);

    // net = 60, facteur = 60/100 = 0.6
    const produitA = resultat.articles.find((a) => a.titreProduit === "Produit A");
    expect(produitA?.montant).toBeCloseTo(36, 5);
    expect(produitA?.montantBrut).toBe(60);
    expect(resultat.articles.find((a) => a.titreProduit === "Produit B")?.montant).toBeCloseTo(24, 5);
    expect(total).toBeCloseTo(60, 5);
  });

  it("exclut les articles d'une commande jamais réellement payée", () => {
    const cmd = commande({
      id: "gid://5",
      name: "#1005",
      transactions: [
        { id: "txn-5", orderId: "gid://5", kind: "sale", status: "pending", amount: 50, gateway: "manual", processedAt: "2026-03-05T10:00:00Z" },
      ],
      articles: [{ id: "li-5", titre: "Produit A", quantite: 1, montant: 50 }],
    });

    const resultat = construireArticlesVendus(cmd);

    expect(resultat.articles).toEqual([]);
  });
});
