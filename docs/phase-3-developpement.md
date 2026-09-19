# Phase 3 — Développement V1

> Rôles mobilisés : DÉVELOPPEUR (code par petites étapes), RELECTEUR (relecture de
> chaque étape), TESTEUR (commandes fictives).
> **Statut : en attente de validation utilisateur avant la Phase 4 (Test réel).**

---

## A. DÉVELOPPEUR — ce qui a été codé, étape par étape

1. **Squelette projet** — `package.json`, `tsconfig.json`, `shopify.app.toml` (scopes,
   webhooks `compliance_topics`), `.env.example`, `.gitignore`. Pas de `shopify app init`
   automatique possible : la commande exige un `--organization-id`/`--client-id` lié à un
   vrai compte Shopify Partner, que je n'ai pas (section 8 du cahier des charges — c'est
   à la charge du propriétaire). La structure suit néanmoins celle du template officiel
   React Router pour que `shopify app connect` s'y greffe sans réécriture.
2. **`config/reglementation.json`** — plafonds 2026 (203 100 €/83 600 €), seuils d'alerte
   80 %/95 %, règle d'encaissement, chacun avec source officielle et date de vérification,
   conformément à la section 3 du cahier des charges. Les taux de cotisations et seuils de
   franchise TVA sont laissés `null` avec un statut « non vérifié » : ils ne servent pas en
   V1 (pas d'estimation de cotisations, pas de gestion TVA dans le MVP) et ne doivent pas
   être utilisés avant vérification.
3. **Moteur du livre des recettes** (`app/lib/domain/livreDesRecettes.ts`) — traduit des
   commandes/transactions Shopify en lignes du livre, en appliquant **exactement** les 5
   décisions CONFORMITÉ de la Phase 1 (`docs/phase-1-verification.md`, section B) :
   paiement manuel → avertissement de vérification de date ; carte cadeau → émission
   comptée, rédemption non recomptée ; BNPL (Alma/Klarna) → montant total compté en une
   fois à la date de la transaction Shopify ; remboursement → ligne négative à sa propre
   date, jamais de modification de l'originale ; canal (POS ou autre) → aucun effet sur la
   règle d'encaissement.
4. **`app/lib/domain/reglementation.ts`** — accès typé au fichier de config (plafond par
   type d'activité, niveau d'alerte `ok`/`avertissement`/`critique`).
5. **Schéma Prisma** (`prisma/schema.prisma`) — `Boutique`, `LigneLivre` (immuable, une
   correction = nouvelle ligne référençant l'originale), `Session`. Isolation
   multi-boutiques par `shopDomain`.
6. **`prisma/rls.sql`** — politiques Row Level Security Supabase, filet de sécurité
   indépendant du code applicatif (cf. Phase 2, section SÉCURITÉ).
7. **Webhooks RGPD** (`app/lib/webhooks/gdpr.ts`) — logique pure et testable (sans
   dépendance à une base réelle, via une interface `DepotLignesLivre`) pour les 3
   webhooks obligatoires : `customers/data_request`, `customers/redact` (anonymise le nom,
   ne supprime jamais la ligne — la conservation légale 10 ans prévaut), `shop/redact`.

## B. TESTEUR — couverture des tests (14/14 passants, `npm test`)

| Scénario fictif | Fichier | Vérifie |
|---|---|---|
| Paiement carte classique | `livreDesRecettes.test.ts` | Ligne positive, pas d'avertissement |
| Transaction échouée/en attente | idem | Aucune ligne générée (pas d'argent entré) |
| Remboursement partiel sur période suivante | idem | Ligne négative à sa propre date, CA de chaque période correct |
| Vente d'une carte cadeau + commande réglée avec cette carte | idem | Un seul encaissement compté (pas de double comptage) |
| Paiement manuel (virement/espèces) | idem | Encaissement compté + avertissement de vérification |
| BNPL tiers (Alma) | idem | Montant total compté en une fois |
| Vente via POS | idem | Même règle d'encaissement, canal juste informatif |
| Jauge de plafond | idem | Bascule `ok` → `avertissement` (80 %) → `critique` (95 %) |
| `customers/data_request` | `gdpr.test.ts` | Ne renvoie que les lignes du client demandeur |
| `customers/redact` | idem | Anonymise le nom, conserve montant/date/référence |
| `shop/redact` | idem | Supprime toutes les lignes de la boutique |

`npm run typecheck` : propre (TypeScript strict).

## C. RELECTEUR — points relevés (à traiter en Phase 4 ou notés comme limites connues)

- **Multi-devises non géré** : le moteur suppose que `amount` est déjà dans la devise de
  déclaration (EUR). Une boutique multi-devises nécessitera une conversion explicite avant
  d'entrer dans le livre — **à couvrir avant tout marchand multi-devises réel**.
- **RLS Supabase dépend d'une discipline applicative** : les politiques dans `prisma/rls.sql`
  supposent que chaque transaction commence par `SELECT set_config('app.current_shop', ...)`.
  Si une requête Prisma brute oublie cet appel, elle échouera à lire des données (RLS bloque
  par défaut) plutôt que d'en fuiter — comportement sûr par défaut, mais **il faut centraliser
  cet appel dans un wrapper unique** (ex. middleware de requête) plutôt que de compter sur
  chaque développeur futur pour y penser.
- **Immutabilité de `LigneLivre` non forcée au niveau base** : actuellement seule
  l'absence de méthode « update » côté application protège les lignes. Une contrainte
  Postgres plus stricte (REVOKE UPDATE/DELETE sauf pour le champ `client` via la fonction
  d'anonymisation RGPD) serait plus robuste — proposé comme durcissement de Phase 4/5, pas
  bloquant pour le test réel.
- **Carte cadeau utilisée en achetant une autre carte cadeau** : cas combiné non testé
  (rare), la logique actuelle le traiterait comme un règlement par carte cadeau normal
  (`compteDansCA: false`), ce qui reste cohérent avec la règle générale mais n'a pas de test
  dédié.

## D. Ce qu'il reste à faire, bloqué sur de vraies credentials (section 8 du cahier des charges)

Non développable sans un compte Shopify Partner + une boutique de développement + un projet
Supabase (création à la charge du propriétaire) :
- Écrans Polaris réels branchés sur les données (actuellement seule la logique métier est
  codée et testée ; le plan des 6 écrans de la Phase 2 reste à implémenter en React Router
  une fois `shopify app dev` utilisable).
- OAuth/App Bridge, session storage Prisma effectivement connecté à Supabase.
- Déploiement Render + connexion Supabase réelle (chaîne `DATABASE_URL`).
- Demandes d'accès `read_all_orders` et « protected customer data » dans le Partner
  Dashboard (démarches manuelles côté Shopify, pas du code).
- Intégration Shopify Billing API (`appSubscriptionCreate`) — nécessite l'app publiée en
  mode non-brouillon.

---

## STOP — Validation demandée

1. Le moteur de calcul et ses règles CONFORMITÉ encodées telles quelles (section A.3) — OK ?
2. La couverture de tests (section B) — suffisante pour la Phase 4, ou des scénarios
   supplémentaires à ajouter avant le test réel ?
3. Les 4 points relevés par le RELECTEUR (section C) — à corriger maintenant, ou acceptés
   comme limites connues pour la suite ?
4. Peut-on considérer la Phase 3 terminée sachant que les écrans Polaris et le déploiement
   réel restent bloqués sur la création de vos comptes Shopify Partner / Supabase (section
   8) ? Dès que vous les aurez créés et partagés (identifiants d'environnement, jamais de
   mots de passe en clair), je pourrai continuer le branchement réel en Phase 4.
