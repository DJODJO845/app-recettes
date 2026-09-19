import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function MentionsLegales() {
  return (
    <s-page heading="Mentions légales">
      <s-section>
        <s-paragraph>
          <s-text type="strong">Cette app est une aide, elle ne remplace pas un expert-comptable.</s-text>
        </s-paragraph>
        <s-paragraph>
          Les montants affichés (chiffre d&apos;affaires encaissé, montant à déclarer,
          plafonds) sont calculés automatiquement à partir des commandes et
          transactions Shopify de votre boutique, selon les règles décrites dans le
          fichier de configuration réglementaire de l&apos;app (plafonds URSSAF,
          principe d&apos;encaissement). Ces règles sont vérifiées régulièrement mais
          peuvent évoluer : en cas de doute sur un montant à déclarer, vérifiez
          auprès de l&apos;URSSAF (autoentrepreneur.urssaf.fr) ou d&apos;un
          expert-comptable avant de déclarer.
        </s-paragraph>
        <s-paragraph>
          Le livre des recettes généré par l&apos;app doit être conservé 10 ans par
          vos soins : en cas de désinstallation de l&apos;app, vos données sont
          supprimées 48h plus tard conformément à la réglementation sur la
          protection des données. Exportez régulièrement votre livre (écran Export).
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
