const URL_AVIS_APP_STORE = "https://apps.shopify.com/recettes-urssaf?locale=fr";

/**
 * Invite à laisser un avis App Store — seul canal qui convertit vraiment bien (un
 * marchand qui cherche "URSSAF" dans l'App Store est déjà presque convaincu), mais
 * dont le volume dépend entièrement des avis obtenus. Affichée seulement après
 * quelques semaines d'usage (voir app._index.tsx) : demander un avis dès l'install,
 * avant d'avoir eu le temps de juger l'app utile, donne des avis moins sincères et
 * moins bien notés.
 */
export function BanniereAvis() {
  return (
    <s-banner tone="success" heading="L'app vous aide au quotidien ?">
      <s-paragraph>
        Un avis sur l&apos;App Store aide d&apos;autres micro-entrepreneurs à trouver
        l&apos;app — ça prend une minute.
      </s-paragraph>
      <s-button slot="primary-action" href={URL_AVIS_APP_STORE} target="_blank">
        Laisser un avis
      </s-button>
    </s-banner>
  );
}
