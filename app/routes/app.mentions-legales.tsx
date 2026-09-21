import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";
import { CONTACT_EMAIL } from "../lib/ui/contact";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function MentionsLegales() {
  return (
    <s-page heading="Mentions légales">
      <s-section heading="Éditeur">
        <s-paragraph>
          Jonathan Larue, entrepreneur individuel (SIRET 900 961 939 00015, RCS Clermont-Ferrand).
        </s-paragraph>
        <s-paragraph>94 avenue de Châtel-Guyon, 63200 Saint-Bonnet-près-Riom, France.</s-paragraph>
        <s-paragraph>
          Contact : <s-link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</s-link>.
        </s-paragraph>
      </s-section>

      <s-section heading="Hébergeur">
        <s-paragraph>
          Render Services, Inc. — 525 Brannan Street Ste 300, San Francisco, CA
          94107, États-Unis. Téléphone : +1 415-319-8186. Email : legal@render.com.
        </s-paragraph>
      </s-section>

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

export const headers: HeadersFunction = headersNonMisEnCache;
