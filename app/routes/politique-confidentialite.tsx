import type { MetaFunction } from "react-router";

/**
 * Route publique (pas de authenticate.admin) : c'est l'URL à renseigner dans
 * la fiche App Store, que Shopify et les commerçants doivent pouvoir
 * consulter sans être connectés à l'admin.
 */
export const meta: MetaFunction = () => [
  { title: "Politique de confidentialité — Recettes URSSAF" },
];

const CONTACT_EMAIL = "jonathan-8495@hotmail.com";
const DERNIERE_MISE_A_JOUR = "20 septembre 2026";

export default function PolitiqueConfidentialite() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem", fontFamily: "sans-serif", color: "#1a1a1a", background: "#ffffff" }}>
      <h1>Politique de confidentialité — Recettes URSSAF</h1>
      <p>Dernière mise à jour : {DERNIERE_MISE_A_JOUR}</p>

      <h2>Qui sommes-nous</h2>
      <p>
        « Recettes URSSAF » est une application Shopify éditée à titre
        individuel. Pour toute question sur cette politique ou sur vos
        données, contactez : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Ce que l&apos;app fait</h2>
      <p>
        L&apos;app génère automatiquement le livre chronologique des recettes
        et calcule le chiffre d&apos;affaires réellement encaissé de votre
        boutique, pour vous aider à remplir votre déclaration URSSAF en tant
        qu&apos;auto-entrepreneur.
      </p>

      <h2>Données que nous traitons</h2>
      <p>Lorsque vous installez l&apos;app, nous accédons via l&apos;API Shopify à :</p>
      <ul>
        <li>vos commandes (numéro, date, statut de paiement) ;</li>
        <li>vos transactions (montant, mode de paiement, devise, canal de vente) ;</li>
        <li>le domaine de votre boutique (<code>*.myshopify.com</code>).</li>
      </ul>
      <p>
        Nous ne recevons jamais vos identifiants de connexion Shopify, ni
        aucun numéro de carte bancaire ou moyen de paiement complet (ces
        données restent gérées uniquement par Shopify et ses prestataires de
        paiement). Le nom du client associé à une commande n&apos;est utilisé
        que si vous avez explicitement autorisé l&apos;accès aux données
        protégées correspondant ; sinon, il apparaît comme « Client »
        générique dans le livre des recettes.
      </p>

      <h2>Pourquoi nous traitons ces données</h2>
      <p>
        Uniquement pour fournir le service que vous avez installé : calculer
        et afficher votre livre des recettes et votre chiffre d&apos;affaires
        encaissé, et vous permettre de les exporter (CSV, version
        imprimable). Nous ne revendons, ne louons et ne partageons jamais ces
        données à des fins commerciales ou publicitaires.
      </p>

      <h2>Où sont hébergées vos données</h2>
      <p>
        Les données calculées par l&apos;app (lignes du livre des recettes)
        sont stockées dans une base de données Supabase (PostgreSQL), avec un
        accès isolé par boutique. L&apos;application elle-même est hébergée
        chez Render. Ces deux prestataires agissent comme sous-traitants
        techniques et n&apos;ont pas d&apos;usage propre de vos données.
      </p>

      <h2>Durée de conservation</h2>
      <p>
        Vos données sont conservées tant que l&apos;app reste installée sur
        votre boutique. En cas de désinstallation, elles sont automatiquement
        supprimées dans les 48 heures, conformément aux exigences de
        Shopify. Le livre des recettes étant une pièce comptable à conserver
        10 ans de votre côté, nous vous recommandons d&apos;exporter
        régulièrement vos données (écran « Export » de l&apos;app) plutôt que
        de compter uniquement sur leur conservation dans l&apos;app.
      </p>

      <h2>Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de
        rectification et d&apos;effacement de vos données. L&apos;app
        implémente les webhooks de conformité obligatoires de Shopify
        (<code>customers/data_request</code>, <code>customers/redact</code>,{" "}
        <code>shop/redact</code>) qui traitent automatiquement les demandes
        relayées par Shopify. Vous pouvez aussi nous contacter directement à{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> pour toute
        demande.
      </p>

      <h2>Cookies et traceurs</h2>
      <p>
        L&apos;app ne dépose aucun cookie de suivi ni traceur publicitaire.
        Elle utilise uniquement les mécanismes techniques nécessaires à son
        fonctionnement dans l&apos;interface Shopify Admin.
      </p>

      <h2>Modifications de cette politique</h2>
      <p>
        Cette politique peut être mise à jour ; la date en haut de page
        indique la dernière révision. En cas de changement important, nous
        vous en informerons via l&apos;app.
      </p>
    </main>
  );
}
