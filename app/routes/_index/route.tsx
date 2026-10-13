import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, Form, Link, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

const URL_APP_STORE = "https://apps.shopify.com/recettes-urssaf?locale=fr";

// Police serif pour les titres uniquement (le corps du texte reste en Inter/sans) —
// le contraste serif/sans sur une seule page est un signal "premium" reconnaissable
// (presse, luxe), spécifique à cette landing page publique : pas chargée dans l'app
// embarquée (Polaris impose déjà sa propre police).
export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" },
];

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

/**
 * Icônes maison (traits simples, pas une librairie) : cohérentes entre elles (même
 * épaisseur, mêmes angles arrondis), légères (pas de dépendance), et faciles à
 * recolorer avec currentColor pour suivre la teinte de chaque carte.
 */
function IconeLivre() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5C4 4.67 4.67 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
      <path d="M20 5.5c0-.83-.67-1.5-1.5-1.5H13v16h5.5c.83 0 1.5-.67 1.5-1.5v-13Z" />
      <path d="M13 7.5h4.5M13 11h4.5M13 14.5h4.5" />
    </svg>
  );
}

function IconeMontant() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5v9M9.25 15c0 1.1 1.23 2 2.75 2s2.75-.9 2.75-2c0-1.38-1.23-1.88-2.75-2.25C10.23 12.38 9 11.88 9 10.5c0-1.1 1.23-2 2.75-2s2.75.9 2.75 2" />
    </svg>
  );
}

function IconeJauge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l3.5-4.5" />
      <path d="M8 19.5h8" />
    </svg>
  );
}

function IconeExport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5v11" />
      <path d="M8 10.5 12 14.5 16 10.5" />
      <path d="M4.5 15v3.5c0 .83.67 1.5 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  );
}

const FONCTIONNALITES = [
  {
    Icone: IconeLivre,
    titre: "Livre des recettes automatique",
    texte: "Généré depuis vos commandes, paiements et remboursements Shopify — chronologique et conforme, sans rien saisir à la main.",
  },
  {
    Icone: IconeMontant,
    titre: "Le bon montant, pas une estimation",
    texte: "Calculé selon le principe d'encaissement : remboursements déduits, cartes cadeaux exclues tant qu'elles ne sont pas utilisées.",
  },
  {
    Icone: IconeJauge,
    titre: "Alertes avant le plafond",
    texte: "Suivi en continu de votre CA annuel, avec projection de la date à laquelle vous l'atteindriez au rythme actuel.",
  },
  {
    Icone: IconeExport,
    titre: "Export et déclaration prêts",
    texte: "CSV, version imprimable et fiche de déclaration par période — tout ce qu'il faut au moment de déclarer.",
  },
] as const;

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div aria-hidden="true" className={styles.heroFond} />
        <div className={styles.heroContenu}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowOr} aria-hidden="true">
              ✦
            </span>
            Pour les micro-entrepreneurs qui vendent sur Shopify
          </p>
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
            <p className={styles.prix}>
              <span className={styles.prixMontant}>9,99 €/mois</span>
              <span className={styles.prixEssai}>7 jours d&apos;essai gratuit</span>
            </p>
          </div>
        </div>
      </header>

      <main className={styles.corps}>
        <section className={styles.fonctionnalites} aria-label="Fonctionnalités">
          {FONCTIONNALITES.map(({ Icone, titre, texte }) => (
            <div key={titre} className={styles.carte}>
              <div className={styles.carteIcone}>
                <Icone />
              </div>
              <h2 className={styles.carteTitre}>{titre}</h2>
              <p className={styles.carteTexte}>{texte}</p>
            </div>
          ))}
        </section>

        <section className={styles.pourquoi}>
          <p className={styles.pourquoiMarque} aria-hidden="true">
            &ldquo;
          </p>
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
      </main>

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
