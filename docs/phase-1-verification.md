# Phase 1 — Vérification

> Rôles mobilisés : CHERCHEUR-MARCHÉ, CONFORMITÉ.
> Objectif : (a) confirmer qu'aucune app Shopify ne fait déjà ce produit, (b) trancher les cas
> limites de la section 3 du cahier des charges.
> **Statut : en attente de validation utilisateur avant la Phase 2 (Architecture).**

---

## A. CHERCHEUR-MARCHÉ

### Recherche menée
Recherche sur le Shopify App Store et sur le web (septembre 2026) pour repérer une app
Shopify qui génère automatiquement le livre des recettes + le CA encaissé à déclarer à
l'URSSAF à partir des commandes/paiements d'une boutique.

### Ce qui existe déjà

| App | Où | Ce qu'elle fait | Différence avec notre produit |
|---|---|---|---|
| **Bizyness** | Shopify App Store | Facturation automatisée + TVA, comptabilité conforme (export FEC…) | Généraliste facturation/TVA, ne calcule pas le CA *encaissé* au sens URSSAF ni ne génère un livre des recettes chronologique non modifiable pour micro-entrepreneur. Cible plutôt le régime réel. |
| **Livre des recettes – compta AE** | App iOS/Mac indépendante | Livre des recettes conforme, export PDF/CSV, calcul de CA par catégorie URSSAF | **Pas connectée à Shopify** : saisie manuelle. Un flux tiers existe (forum Abby) pour automatiser Shopify → Abby via Make, ce qui confirme que le besoin d'automatisation est ressenti mais non couvert nativement. |
| **AutoEntrepreneur URSSAF** (app officielle) | App iOS indépendante | Déclaration et paiement des cotisations | Ne lit aucune donnée Shopify ; sert uniquement à déclarer le chiffre déjà calculé ailleurs. |
| **Gestion Micro-Entrepreneur** | App iOS/Mac indépendante | Registres (recettes, achats), rapports périodiques | Idem : pas de connexion Shopify. |

### Conclusion
Aucune app du Shopify App Store ne combine : lecture automatique des commandes/paiements/
remboursements Shopify **+** génération du livre des recettes réglementaire **+** calcul du
CA encaissé à déclarer à l'URSSAF pour un micro-entrepreneur français. **Le champ est libre.**
Point de vigilance concurrentiel : Bizyness est l'app la plus proche à surveiller si elle
ajoute un jour un mode « micro-entrepreneur / URSSAF ».

---

## B. CONFORMITÉ — Décisions sur les cas limites

Ces décisions sont des **positions produit documentées et sourcées**, prises pour permettre
le développement. Elles ne remplacent pas une validation finale par un expert-comptable ou
l'URSSAF avant mise en production publique (cf. section 8 du cahier des charges). Chaque
règle ci-dessous devra être encodée dans `config/reglementation.json` ou dans la logique
métier avec sa source.

### 1. Paiements manuels (virement, espèces)
**Décision** : la date d'encaissement retenue est la date de la transaction Shopify marquée
manuellement comme payée (`processed_at`/`created_at` de la transaction manuelle), **avec un
avertissement explicite dans l'interface** indiquant que c'est au marchand de vérifier que
cette date correspond à la date réelle de réception des fonds (l'espèce en main, le virement
crédité en banque), et de corriger via une **ligne de correction** (jamais une modification)
si ce n'est pas le cas.
Source : la date qui compte est celle où l'argent est réellement crédité/reçu, indépendamment
du moyen de paiement (Allez je me lance ; Solo.fr).

### 2. Cartes cadeaux
**Décision** (traitement en deux temps, pour éviter le double comptage) :
- **Émission/vente d'une carte cadeau** = un encaissement réel (l'argent entre en banque) →
  une ligne dans le livre des recettes à la date de la vente, nature « Vente de carte cadeau ».
- **Commande réglée avec une carte cadeau** = **pas** un nouvel encaissement pour la part
  payée en carte cadeau (l'argent est déjà entré lors de l'achat de la carte) → cette part
  n'est **pas** recomptée dans le CA de la période ; seule la part éventuellement payée par un
  autre moyen (carte bancaire pour le complément, par exemple) compte comme un nouvel
  encaissement.
- Rationale : évite de déclarer deux fois le même euro à l'URSSAF (principe de caisse).
Ce point est le plus débattu comptablement (traitement en compte 487 « produits constatés
d'avance » pour les entreprises au réel, vs. logique de caisse simplifiée du micro-entrepreneur)
→ **à faire valider explicitement par un expert-comptable avant publication.**
Sources : Keobiz, Ubiliz, ceservices.fr sur le traitement comptable des cartes cadeaux.

### 3. Paiements partiels, acomptes, paiement en plusieurs fois (Alma, Klarna…)
**Décision** :
- **BNPL tiers (Alma, Klarna)** : le prestataire avance généralement la totalité des fonds au
  marchand dès la validation de la commande. On se base donc sur la transaction Shopify de
  type capture/vente et sa date (celle où Shopify marque la commande « payée »), **pas** sur
  l'échéancier de remboursement du client envers Alma/Klarna.
- **Acomptes gérés directement par le marchand** (hors BNPL) : chaque paiement partiel
  effectivement reçu via Shopify constitue sa propre ligne, à sa propre date d'encaissement
  (l'acompte à sa date, le solde à sa date).
Source : Auctus Compta sur la comptabilisation des paiements échelonnés Klarna/Alma ; principe
URSSAF de déclaration au rythme réel des encaissements (chaque versement déclaré sur sa période).

### 4. Commandes annulées après paiement / remboursements partiels
**Décision** : jamais de suppression ni de modification de la ligne d'origine. Le remboursement
crée une **ligne négative à sa propre date d'encaissement** (celle du remboursement, pas celle
de la commande). Si le remboursement tombe sur une période de déclaration déjà transmise à
l'URSSAF, il vient en déduction du CA de la période **du remboursement** (période courante),
sans réécriture rétroactive de la déclaration déjà faite — cohérent avec le principe « chronologique,
non modifiable » du livre des recettes.
Sources : LegalPlace, pratique observée sur la gestion des avoirs en micro-entreprise.

### 5. Ventes via Shopify POS ou autres canaux connectés
**Décision** : même règle d'encaissement quel que soit le canal de vente (en ligne, POS,
marketplace connectée…) — une transaction Shopify marquée « payée » à une date donnée génère
une ligne à cette date. Le canal peut être affiché comme information complémentaire dans le
livre des recettes mais ne modifie pas le calcul du CA encaissé.

---

## C. Points d'architecture à anticiper dès la Phase 2 (remontés par CONFORMITÉ)
- Modéliser les cartes cadeaux comme un type de transaction Shopify à part (`gift_card`) pour
  appliquer la règle « pas de double comptage » de la section B.2.
- Le champ « scope `read_all_orders`/protected customer data » devra être demandé tôt dans le
  Partner Dashboard (accès protégé requis pour toute boutique de production, pas nécessaire en
  boutique de développement) — confirmé par la doc Shopify actuelle (shopify.dev, changelog
  « Apps can now request access to necessary protected data »).

---

## STOP — Validation demandée

Merci de valider avant de passer à la Phase 2 (Architecture) :
1. La conclusion du CHERCHEUR (aucun concurrent direct, champ libre) — **OK pour continuer ?**
2. Les 5 décisions CONFORMITÉ ci-dessus, en particulier le point le plus sensible : le
   traitement des **cartes cadeaux** (émission = encaissement, rédemption = pas de nouvel
   encaissement) — **d'accord avec cette position, ou préférez-vous la faire trancher
   directement par un expert-comptable avant qu'on la code ?**
