import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, Form, Link, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

const URL_APP_STORE = "https://apps.shopify.com/recettes-urssaf?locale=fr";

export const meta: MetaFunction = () => [
  { title: "Recettes URSSAF — Le CA encaissé de votre micro-entreprise, calculé seul" },
  {
    name: "description",
    content:
      "Livre des recettes automatique et montant exact à déclarer à l'URSSAF, calculés depuis vos commandes Shopify. 9,99 €/mois, 7 jours d'essai gratuit.",
  },
  // Page publique consultée hors de l'iframe Shopify Admin (navigateur mobile
  // normal) : le mode sombre forcé de certains navigateurs/OS peut rendre le
  // texte illisible s'il ne repose que sur l'héritage CSS — même bug déjà
  // rencontré et corrigé sur politique-confidentialite.tsx et les versions
  // imprimables.
  { name: "color-scheme", content: "light" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // `shop` seul ne suffit pas : Shopify peut renvoyer ici (ex. clic sur le titre de
  // l'app dans la nav embarquée) avec `host` ou `embedded` mais sans `shop`, auquel
  // cas on affichait par erreur la page publique (formulaire "Domaine de la
  // boutique") au lieu de ramener directement au tableau de bord — bloquant le
  // marchand dans l'app embarquée (observé en test le 7 octobre 2026).
  if (
    url.searchParams.get("shop") ||
    url.searchParams.get("host") ||
    url.searchParams.get("embedded")
  ) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

const FONCTIONNALITES = [
  {
    titre: "Livre des recettes automatique",
    texte: "Généré depuis vos commandes, paiements et remboursements Shopify — chronologique et conforme, sans rien saisir à la main.",
  },
  {
    titre: "Le bon montant, pas une estimation",
    texte: "Calculé selon le principe d'encaissement : remboursements déduits, cartes cadeaux exclues tant qu'elles ne sont pas utilisées.",
  },
  {
    titre: "Alertes avant le plafond",
    texte: "Suivi en continu de votre CA annuel, avec projection de la date à laquelle vous l'atteindriez au rythme actuel.",
  },
  {
    titre: "Export et déclaration prêts",
    texte: "CSV, version imprimable et fiche de déclaration par période — tout ce qu'il faut au moment de déclarer.",
  },
] as const;

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Pour les micro-entrepreneurs qui vendent sur Shopify</p>
        <h1 className={styles.heading}>Le chiffre d&apos;affaires encaissé de votre boutique, calculé seul</h1>
        <p className={styles.sousTitre}>
          Le livre des recettes de votre micro-entreprise se génère automatiquement, et
          le montant exact à déclarer à l&apos;URSSAF chaque période est toujours sous
          les yeux — sans tableur, sans recompter à la main.
        </p>
        <div className={styles.cta}>
          <a className={styles.bouton} href={URL_APP_STORE} target="_blank" rel="noreferrer">
            Installer sur Shopify
          </a>
          <p className={styles.prix}>9,99 €/mois · 7 jours d&apos;essai gratuit</p>
        </div>
      </header>

      <section className={styles.fonctionnalites} aria-label="Fonctionnalités">
        {FONCTIONNALITES.map((fonctionnalite) => (
          <div key={fonctionnalite.titre} className={styles.carte}>
            <h2 className={styles.carteTitre}>{fonctionnalite.titre}</h2>
            <p className={styles.carteTexte}>{fonctionnalite.texte}</p>
          </div>
        ))}
      </section>

      <section className={styles.pourquoi}>
        <h2 className={styles.sectionTitre}>Pourquoi pas juste un tableur ?</h2>
        <p className={styles.sectionTexte}>
          Le CA à déclarer est celui <strong>réellement encaissé</strong>, pas celui de
          vos commandes facturées — et la différence piège souvent une déclaration
          faite à la main : un remboursement partiel, un paiement en plusieurs fois,
          une carte cadeau vendue puis utilisée plus tard. L&apos;app applique ces
          règles pour vous, à chaque commande, sans que vous ayez à les connaître par
          cœur.
        </p>
      </section>

      <footer className={styles.pied}>
        {showForm && (
          <details className={styles.connexion}>
            <summary>Déjà cliente ou client ? Se connecter</summary>
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={styles.label}>
                <span>Domaine de la boutique</span>
                <input className={styles.input} type="text" name="shop" placeholder="ma-boutique.myshopify.com" />
              </label>
              <button className={styles.boutonSecondaire} type="submit">
                Se connecter
              </button>
            </Form>
          </details>
        )}
        <p className={styles.piedLiens}>
          <Link to="/politique-confidentialite">Politique de confidentialité</Link>
        </p>
      </footer>
    </div>
  );
}
