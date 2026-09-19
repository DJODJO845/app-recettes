# Phase 2 — Architecture

> Rôles mobilisés : ARCHITECTE, SÉCURITÉ (relecture).
> Objectif : schéma technique, choix d'hébergement justifié, liste des scopes, plan des écrans.
> **Statut : en attente de validation utilisateur avant la Phase 3 (Développement V1).**

---

## A. ARCHITECTE

### 1. Template de départ
**Décision : `shopify app init --template=https://github.com/Shopify/shopify-app-template-react-router`**

Le template Remix officiel est désormais déprécié par Shopify au profit de **React Router**
(`@shopify/shopify-app-react-router`), qui est la recommandation actuelle pour toute nouvelle
app (confirmé sur shopify.dev, septembre 2026). On part donc du template React Router, pas
de Remix — conforme à l'exigence « template officiel le plus récent ».

Stack fournie par le template : Node.js, React Router côté serveur/rendu, Polaris pour l'UI,
App Bridge pour l'intégration dans l'admin Shopify, Prisma comme ORM par défaut (que l'on
adaptera pour pointer vers Supabase Postgres à la place de SQLite).

### 2. Hébergement — décision et justification

**Décision : Render (plan gratuit « Web Service »), pas Cloudflare Workers.**

Le cahier des charges demande d'évaluer Cloudflare en priorité. Vérification faite :
- Le template **React Router** actuel n'a **pas** de guide de déploiement Cloudflare officiel
  à ce jour ; les adaptations Cloudflare Workers trouvées (dépôts communautaires) ciblent
  l'ancien template **Remix**, aujourd'hui déprécié, et un ticket ouvert sur le dépôt officiel
  Shopify demande encore la documentation d'un déploiement Cloudflare Pages/Workers pour le
  nouveau template.
- Cloudflare Workers ne supporte pas nativement une connexion Postgres classique (TCP) :
  il faudrait ajouter Cloudflare **Hyperdrive** en plus, une couche technique supplémentaire,
  pour parler à Supabase.
- Conclusion : Cloudflare est **techniquement séduisant mais pas la simplicité maximale
  compatible avec le template actuel** — il ajoute deux couches de compatibilité non
  officielles (template forké + Hyperdrive) pour un projet solo sans équipe dédiée à leur
  maintenance.

**Alternative retenue : Render**, plan gratuit « Web Service » (Node) :
- Le template React Router tourne tel quel (process Node standard, Dockerfile fourni par
  Shopify) — zéro adaptation.
- Connexion directe à Supabase Postgres en TCP standard (pooler Supabase / pgbouncer), sans
  couche intermédiaire.
- Gratuit pour un trafic faible (usage réel attendu : quelques connexions par jour par
  marchand). Contrepartie acceptée : mise en veille après inactivité et redémarrage à froid
  de quelques secondes au premier accès — acceptable pour une app d'admin consultée
  ponctuellement, pas une boutique à fort trafic. Si cela devient gênant, un ping de
  réveil planifié (cron gratuit, ex. cron-job.org) pourra être ajouté sans changer
  d'architecture.
- Pas de carte bancaire requise pour démarrer sur le plan gratuit, contrairement à certaines
  alternatives (Fly.io demande désormais une carte même sur son offre d'entrée).

### 3. Stockage
**Supabase (Postgres)**, conforme au cahier des charges, pour :
- Les sessions Shopify (remplace le stockage SQLite par défaut du template).
- Le **cache des écritures** du livre des recettes (une ligne par encaissement/remboursement,
  jamais modifiée après écriture — champ `created_at` immuable, corrections = nouvelles lignes
  avec un lien vers la ligne d'origine).
- **Isolation multi-marchands** : Row Level Security (RLS) Postgres activée, chaque ligne
  scoping par `shop_domain`, aucune requête cross-boutique possible même en cas de bug
  applicatif.

### 4. Scopes Shopify demandés
| Scope | Usage | Statut |
|---|---|---|
| `read_orders` | Commandes et transactions des 60 derniers jours | Standard, disponible immédiatement |
| `read_all_orders` | Historique complet (import initial + reconstitution du livre depuis la date de début d'activité) | **Demande d'approbation** via Partner Dashboard (API access requests), à soumettre tôt |
| Accès **protected customer data** (nom du client) | Champ « client » obligatoire sur chaque ligne du livre des recettes (section 3 du cahier des charges) | **Demande d'approbation** via Partner Dashboard ; on ne demande **que** le nom, pas l'e-mail/téléphone/adresse, pour rester sur le périmètre minimal nécessaire |

Aucun scope d'écriture n'est demandé : l'app ne modifie jamais les commandes, elle les lit
seulement.

### 5. Facturation
**Shopify Billing API** (mutation GraphQL `appSubscriptionCreate`), API version 2026-10+,
conforme à l'obligation pour une app publique. Deux plans : Gratuit (tableau de bord du mois
en cours) et Pro (abonnement mensuel, essai gratuit géré via `trialDays` de la mutation).

### 6. Webhooks RGPD obligatoires
Configurés dans `shopify.app.toml` via `compliance_topics` (format simplifié disponible
depuis l'API 2026-01) :
- `customers/data_request` → génère un export des lignes du livre liées à ce client.
- `customers/redact` → anonymise le nom du client sur les lignes conservées (on ne peut pas
  supprimer la ligne elle-même : c'est une obligation légale de conservation de 10 ans qui
  prévaut sur la demande de suppression du nom ; seul l'identifiant nominatif est retiré).
- `shop/redact` → reçu 48 h après désinstallation : suppression de toutes les données de la
  boutique. C'est le webhook qui matérialise le conflict décrit section 5 du cahier des
  charges → traité par des rappels d'export répétés **avant** ce délai (cf. plan des écrans).

### 7. Plan des écrans (Polaris, 100 % français, utilisables depuis un téléphone via l'app
Shopify mobile qui embarque l'admin)

1. **Tableau de bord** (page d'accueil) : gros chiffre CA encaissé de la période en cours,
   montant à déclarer, jauge plafond annuel (80 %/95 % en couleur), bannière si période à 0 €
   (rappel qu'il faut déclarer quand même).
2. **Livre des recettes** : table chronologique paginée, filtres (période, mode de paiement,
   canal), lignes négatives (remboursements) visuellement distinguées, aucune action
   d'édition/suppression proposée dans l'UI (conforme à l'exigence « non modifiable »).
3. **Export** : boutons CSV et PDF sur la période choisie, rappel du texte « à conserver 10
   ans vous-même ».
4. **Réglages** : type d'activité (commerce/service/mixte), périodicité de déclaration
   (mois/trimestre), date de début d'activité.
5. **Écran de désinstallation / bannière permanente** : rappel « exportez votre livre
   régulièrement, il sera supprimé après désinstallation » avec bouton d'export direct,
   affiché dès l'installation et rappelé périodiquement (pas seulement au moment de
   désinstaller, puisqu'on ne peut pas intercepter cette action côté app).
6. **Mentions légales** : texte fixe « cette app est une aide, elle ne remplace pas un
   expert-comptable », accessible depuis toutes les pages (pied de page).

---

## B. SÉCURITÉ — Relecture

- **Vérification HMAC** de tous les webhooks entrants (Shopify signe chaque payload) — géré
  par les helpers du package `@shopify/shopify-app-react-router`, à ne pas contourner.
- **Aucune donnée de paiement brute** (numéro de carte, etc.) ne transite ni n'est stockée :
  on ne lit que les objets `Order`/`Transaction` déjà traités par Shopify (montant, statut,
  date, moyen de paiement générique).
- **Secrets** (clé API Shopify, `DATABASE_URL` Supabase) uniquement en variables
  d'environnement Render, jamais commités ; `.env.example` versionné sans valeurs réelles.
- **RLS Supabase par `shop_domain`** comme filet de sécurité en plus de l'isolation
  applicative, pour qu'un bug de requête ne puisse jamais exposer les données d'une autre
  boutique.
- **Traitement des demandes RGPD dans les délais** : `customers/data_request` et
  `customers/redact` traités automatiquement (job asynchrone) avec réponse HTTP 200
  immédiate à Shopify puis traitement effectif sous 30 jours max, comme l'exige Shopify.
- **Principe du moindre scope** : uniquement `read_orders`/`read_all_orders` et l'accès
  minimal aux « protected customer data » (nom seul) — jamais `write_*`, jamais e-mail/
  téléphone/adresse client tant que le produit n'en a pas explicitement besoin.
- **Export CSV/PDF** généré à la demande côté serveur (jamais de données d'une boutique dans
  le cache/CDN partagé) et transmis directement au marchand, pas de lien public permanent.
- Point d'attention pour la Phase 3 : écrire des tests spécifiques sur la vérification HMAC
  et sur l'isolation RLS (tenter une requête cross-boutique doit échouer).

---

## STOP — Validation demandée

Merci de valider avant de passer à la Phase 3 (Développement V1) :
1. Template **React Router** (au lieu de Remix, déprécié) — OK ?
2. Hébergement **Render gratuit** plutôt que Cloudflare Workers (raisons : pas de guide
   officiel Cloudflare pour le nouveau template + couche Hyperdrive supplémentaire requise
   pour Supabase) — OK, ou préférez-vous qu'on investisse quand même dans l'adaptation
   Cloudflare malgré ces frictions ?
3. Les scopes demandés (`read_orders`, `read_all_orders`, accès protégé au nom du client
   uniquement) — OK ?
4. Le plan des 6 écrans — OK, ou faut-il en ajouter/retirer avant de coder ?
