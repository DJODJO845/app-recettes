import type { ReactNode } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "react-router";

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

// N'intercepte que les routes hors de /app/* : celles-ci ont leur propre
// ErrorBoundary (app.tsx, via boundary.error de Shopify, nécessaire à ses
// redirections d'authentification). Sans ce filet ici, une erreur sur une
// page publique (ex. politique-confidentialite.tsx) afficherait la page
// d'erreur brute par défaut de React Router plutôt qu'un message soigné.
export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Une erreur inattendue s'est produite.";

  return (
    <Document>
      <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem", fontFamily: "sans-serif", color: "#1a1a1a", background: "#ffffff", textAlign: "center" }}>
        <h1 style={{ fontSize: "20px" }}>Oups, quelque chose s&apos;est mal passé</h1>
        <p style={{ color: "#555" }}>{message}</p>
        <p>
          <a href="/" style={{ color: "#0E6B5C" }}>Retour à l&apos;accueil</a>
        </p>
      </main>
    </Document>
  );
}
