import type { LinksFunction, MetaFunction } from "react-router";
import { Link } from "react-router";

import styles from "./styles.module.css";

const URL_APP_STORE = "https://apps.shopify.com/recettes-urssaf?locale=fr";

// Même police serif que la landing page (_index), pour une identité cohérente entre
// les deux pages publiques — pas chargée dans l'app embarquée (Polaris a sa police).
export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" },
];

export const meta: MetaFunction = () => [
  { title: "CA encaissé URSSAF depuis Shopify : calcul et pièges à éviter" },
  {
    name: "description",
    content:
      "Comment calculer le chiffre d'affaires réellement encaissé à déclarer à l'URSSAF depuis vos commandes Shopify : méthode, pièges courants (remboursements, cartes cadeaux), et comment l'automatiser.",
  },
  { name: "color-scheme", content: "light" },
];

const FAQ = [
  {
    question: "Le CA à déclarer, c'est celui des commandes ou celui réellement payé ?",
    reponse:
      "Celui réellement encaissé : la date qui compte est celle du paiement réussi, pas celle de la commande. Une commande passée fin de mois mais payée (ou dont le paiement manuel est confirmé) le mois suivant se déclare sur le mois suivant.",
  },
  {
    question: "Les frais de livraison comptent-ils dans le CA ?",
    reponse:
      "Oui, s'ils sont payés par le client : le prix total payé (produit + livraison) fait partie du chiffre d'affaires. Si la livraison est offerte, seul le prix du produit compte — et le coût de livraison payé au transporteur reste une dépense, non déductible du CA en micro-entreprise.",
  },
  {
    question: "Un remboursement, je fais quoi ?",
    reponse:
      "Il se déclare comme une ligne négative à la date du remboursement, jamais en modifiant la ligne de vente d'origine. Si le remboursement tombe sur une période de déclaration différente de la vente, chacun se déclare sur sa propre période.",
  },
  {
    question: "Et les cartes cadeaux ?",
    reponse:
      "La vente d'une carte cadeau compte dans le CA à ce moment-là. Son utilisation ultérieure pour régler une commande ne compte pas une deuxième fois — l'argent est déjà entré en compte lors de l'achat de la carte.",
  },
] as const;

export default function GuideCAEncaisseUrssafShopify() {
  return (
    <div className={styles.page}>
      <header className={styles.entete}>
        <p className={styles.fil}>
          <Link to="/">← Recettes URSSAF</Link>
        </p>
        <h1 className={styles.titre}>Comment calculer le CA encaissé à déclarer à l&apos;URSSAF depuis Shopify</h1>
        <p className={styles.chapeau}>
          Vos commandes Shopify ne suffisent pas à remplir une déclaration URSSAF fiable —
          voici la méthode, les pièges les plus fréquents, et comment éviter de tout
          recompter à la main chaque mois ou trimestre.
        </p>
      </header>

      <main className={styles.corps}>
        <h2>CA facturé vs CA encaissé : la différence qui compte</h2>
        <p>
          En micro-entreprise, l&apos;URSSAF demande le chiffre d&apos;affaires{" "}
          <strong>réellement encaissé</strong> sur la période (mensuelle ou
          trimestrielle selon votre régime), pas le total de vos commandes passées. Ce
          n&apos;est pas qu&apos;une nuance administrative : une commande passée le 30
          du mois mais payée le 2 du mois suivant se déclare sur{" "}
          <strong>le mois suivant</strong>, pas sur le mois de la commande.
        </p>
        <p>
          Shopify ne fait pas cette distinction pour vous : le rapport de ventes par
          défaut regroupe par date de commande, pas par date d&apos;encaissement
          réel — ce qui suffit rarement à une déclaration exacte.
        </p>

        <h2>Les pièges les plus fréquents quand on calcule à la main</h2>
        <ul>
          <li>
            <strong>Remboursements et avoirs</strong> : à déduire à la date du
            remboursement, jamais en modifiant la vente d&apos;origine.
          </li>
          <li>
            <strong>Cartes cadeaux</strong> : comptées à la vente de la carte, pas à son
            utilisation (sinon le même argent est compté deux fois).
          </li>
          <li>
            <strong>Paiements manuels</strong> (virement, espèces) : encaissés à la date
            réelle de réception des fonds, que Shopify ne connaît pas toujours
            précisément.
          </li>
          <li>
            <strong>Paiements en plusieurs fois</strong> (Alma, Klarna…) : chaque
            échéance encaissée compte à sa propre date, pas la totalité à la commande.
          </li>
          <li>
            <strong>Frais de livraison</strong> : inclus dans le CA s&apos;ils sont
            payés par le client, même sans marge dessus.
          </li>
        </ul>

        <h2>Comment le calculer soi-même depuis l&apos;admin Shopify</h2>
        <p>Si vous préférez faire ça manuellement (pour un petit volume de commandes, par exemple) :</p>
        <ol>
          <li>
            Dans <strong>Commandes</strong>, filtrez par statut de paiement
            &laquo;&nbsp;Payée&nbsp;&raquo; plutôt que par date de commande.
          </li>
          <li>
            Repérez la date de capture du paiement de chaque commande (pas sa date de
            création) — visible dans le détail de chaque commande, section
            &laquo;&nbsp;Paiement&nbsp;&raquo;.
          </li>
          <li>
            Additionnez les montants réellement capturés sur votre période de
            déclaration, en excluant les commandes seulement autorisées mais non
            capturées.
          </li>
          <li>
            Pour chaque remboursement émis sur la période, soustrayez-le à part —
            n&apos;allez pas corriger le montant de la vente d&apos;origine.
          </li>
        </ol>
        <div className={styles.encart}>
          <p>
            Au-delà d&apos;une poignée de commandes par mois, ce recoupement
            manuel (commande → paiement → remboursement éventuel) devient vite long et
            source d&apos;erreurs — c&apos;est exactement ce que l&apos;automatisation
            ci-dessous fait à votre place.
          </p>
        </div>

        <h2>Automatiser le calcul avec Recettes URSSAF</h2>
        <p>
          Recettes URSSAF se connecte à votre boutique Shopify et applique ces règles
          automatiquement à chaque commande : livre des recettes chronologique généré
          seul, montant exact à déclarer affiché pour la période en cours, alertes
          avant d&apos;atteindre votre plafond annuel, export CSV et fiche de
          déclaration prête à l&apos;emploi.
        </p>

        <div className={styles.ctaBloc}>
          <p className={styles.ctaTitre}>Arrêtez de recompter à la main</p>
          <p className={styles.ctaTexte}>9,99 €/mois · 7 jours d&apos;essai gratuit</p>
          <a className={styles.bouton} href={URL_APP_STORE} target="_blank" rel="noreferrer">
            Installer sur Shopify
          </a>
        </div>

        <div className={styles.faq}>
          <h2>Questions fréquentes</h2>
          {FAQ.map((item) => (
            <div key={item.question} className={styles.faqItem}>
              <p className={styles.faqQuestion}>{item.question}</p>
              <p className={styles.faqReponse}>{item.reponse}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className={styles.pied}>
        <Link to="/politique-confidentialite">Politique de confidentialité</Link>
      </footer>

      {/* Données structurées FAQPage : améliore les chances d'extrait enrichi dans
          les résultats Google pour les questions ci-dessus. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- JSON-LD statique, pas de contenu utilisateur
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.reponse },
            })),
          }),
        }}
      />
    </div>
  );
}
