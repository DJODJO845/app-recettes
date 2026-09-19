# CAHIER DES CHARGES — App Shopify « Livre des recettes & URSSAF »

> À coller dans Claude Code (onglet Code de l'app mobile), dans un dépôt GitHub vide.
> Première instruction pour Claude Code : enregistre ce document sous `docs/cahier-des-charges.md`,
> puis suis-le en jouant les 11 rôles (chercheur-marche, avocat-du-diable, strategiste, finance,
> architecte, developpeur, relecteur-code, testeur, securite, conformite, marketing).
> RÈGLE ABSOLUE : STOP et demande validation à la fin de chaque phase. Ne jamais sauter une porte.

---

## 1. Le produit en une phrase

Une app Shopify qui génère automatiquement le **livre des recettes** obligatoire d'un
micro-entrepreneur français et lui donne le **montant exact de CA encaissé à déclarer à l'URSSAF**
pour chaque période, à partir des commandes, paiements et remboursements de sa boutique.

## 2. Cible

- Micro-entrepreneurs français qui vendent sur Shopify (vente de marchandises en priorité).
- Ils ne sont pas comptables, veulent un chiffre fiable en 1 minute, et ont peur d'un contrôle.

## 3. Règles métier (à faire valider par l'agent CONFORMITÉ avant tout code)

- On déclare le CA **encaissé**, pas facturé : la date qui compte est la date du paiement réussi.
- Les commissions et frais de paiement **ne se déduisent pas** du CA : on déclare le brut encaissé.
- Un remboursement = une ligne négative à la date du remboursement.
- Les frais de livraison payés par le client font partie des recettes.
- Livre des recettes : chronologique, **non modifiable** (une correction = une nouvelle ligne,
  jamais une modification), à conserver 10 ans.
- Mentions par ligne : date d'encaissement, référence (n° de commande / facture), client,
  nature de la vente, montant, mode de règlement.
- Déclaration URSSAF : mensuelle ou trimestrielle (paramètre choisi par le marchand), même à 0 €.

### Cas limites à trancher par CONFORMITÉ (ne pas deviner)
- Paiements manuels (virement, espèces) : encaissés à quelle date dans Shopify ?
- Vente de cartes cadeaux et commandes payées avec une carte cadeau.
- Paiements partiels, acomptes, paiement en plusieurs fois (Alma, Klarna…).
- Commandes annulées après paiement, remboursements partiels.
- Ventes via Shopify POS ou autres canaux connectés.

### Chiffres qui changent : JAMAIS en dur dans le code
Plafonds de CA (en 2026 : 203 100 € pour le commerce, 83 600 € pour les services), taux de
cotisations, seuils de franchise de TVA : tout va dans un fichier de configuration
`config/reglementation.json` avec, pour chaque valeur, **la source officielle et la date de
vérification**. L'agent CONFORMITÉ vérifie chaque valeur sur urssaf.fr / service-public.fr
avant la mise en ligne, puis au moins une fois par an.

## 4. Fonctionnalités

### V1 (MVP — ne rien ajouter d'autre)
1. **Tableau de bord** : CA encaissé de la période en cours + montant à déclarer, en gros.
2. **Livre des recettes** : liste chronologique, filtres par période.
3. **Export** CSV et PDF du livre (le marchand doit pouvoir le conserver 10 ans lui-même).
4. **Alerte plafond** : jauge du CA annuel vs plafond, alerte à 80 % et 95 %.
5. **Réglages** : type d'activité, périodicité (mois/trimestre), date de début d'activité.
6. **Mention légale visible** : l'app est une aide, elle ne remplace pas un expert-comptable.

### V2 (plus tard, seulement après validation de la V1)
- Registre des achats, rappels d'échéances par e-mail, estimation des cotisations,
  multi-boutiques.

## 5. Contraintes techniques Shopify (à vérifier par l'ARCHITECTE dans la doc officielle actuelle)

- Partir du **template officiel le plus récent** de Shopify CLI (`shopify app init`).
- App intégrée à l'admin Shopify, interface avec Polaris, 100 % en français.
- Scopes minimum : lecture des commandes et transactions. Pour l'historique de plus de 60 jours,
  demander l'accès `read_all_orders` dans le Partner Dashboard.
- **Données clients protégées** : afficher le nom du client exige une demande d'accès aux
  « protected customer data » et le respect des exigences associées. À préparer tôt.
- **Webhooks RGPD obligatoires** : customers/data_request, customers/redact, shop/redact.
- ⚠️ Conflit à gérer : à la désinstallation, les données doivent être supprimées, alors que le
  livre doit être conservé 10 ans → l'app pousse le marchand à **exporter régulièrement**
  (rappel dans l'app + export avant désinstallation).
- **Facturation : Shopify Billing API obligatoire** pour une app publique (pas Stripe).
- Stockage : Supabase (Postgres) pour les sessions et le cache des écritures.
- Hébergement gratuit : l'architecte propose l'option la plus simple compatible avec le
  template (Cloudflare si compatible, sinon autre offre gratuite) et justifie son choix.
- Tout doit pouvoir être piloté depuis un téléphone (pas d'étape qui exige un PC).

## 6. Modèle économique (HYPOTHÈSES à valider par FINANCE)

- Gratuit : tableau de bord du mois en cours.
- Pro : livre complet, exports, alertes — petit abonnement mensuel (prix exprimé en USD sur
  l'App Store). Essai gratuit.
- Aucun chiffre de revenus promis. Toute projection est marquée « hypothèse ».

## 7. Phases (avec STOP à chaque porte)

1. **Vérification** — CHERCHEUR : confirmer qu'aucune app Shopify ne fait déjà ça.
   CONFORMITÉ : trancher les cas limites de la section 3. → STOP
2. **Architecture** — ARCHITECTE : schéma technique, choix d'hébergement, liste des scopes,
   plan des écrans. SÉCURITÉ : relit. → STOP
3. **Développement V1** — DÉVELOPPEUR code par petites étapes ; RELECTEUR relit chaque étape ;
   TESTEUR écrit des tests avec des commandes fictives (paiement, remboursement partiel,
   carte cadeau, paiement manuel). → STOP
4. **Test réel** — installation sur une boutique de développement gratuite, commandes de test,
   comparaison du montant calculé avec un calcul à la main. → STOP
5. **Publication** — MARKETING : fiche App Store en français, captures, FAQ.
   CONFORMITÉ : politique de confidentialité, mentions légales. Soumission à Shopify. → STOP

## 8. Ce que Claude Code NE fait PAS (à la charge du propriétaire)
- Créer le compte Shopify Partner, la boutique de développement, le compte Supabase.
- Saisir des mots de passe, clés secrètes ou coordonnées bancaires.
- Garantir la conformité juridique finale : en cas de doute, vérifier auprès de l'URSSAF
  ou d'un expert-comptable.
