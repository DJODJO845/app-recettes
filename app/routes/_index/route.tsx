import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const meta: MetaFunction = () => [{ title: "Recettes URSSAF" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Recettes URSSAF</h1>
        <p className={styles.text}>
          Le livre des recettes de votre micro-entreprise généré automatiquement, et
          le montant exact de chiffre d&apos;affaires encaissé à déclarer chaque
          période.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Domaine de la boutique</span>
              <input className={styles.input} type="text" name="shop" />
              <span>ex : ma-boutique.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Se connecter
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Livre des recettes automatique.</strong> Généré à partir de vos
            commandes, paiements et remboursements Shopify.
          </li>
          <li>
            <strong>Montant à déclarer à l&apos;URSSAF.</strong> Calculé selon le
            principe d&apos;encaissement, sans avoir à faire le calcul vous-même.
          </li>
          <li>
            <strong>Export CSV et PDF.</strong> Pour conserver votre livre 10 ans,
            comme l&apos;exige la réglementation.
          </li>
        </ul>
      </div>
    </div>
  );
}
