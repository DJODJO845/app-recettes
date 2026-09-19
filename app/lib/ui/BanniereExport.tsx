/**
 * Rappel permanent d'export (écran 5 du plan, docs/phase-2-architecture.md) : le
 * livre doit être conservé 10 ans par le marchand, alors que `shop/redact` supprime
 * tout 48h après désinstallation. On ne peut pas intercepter la désinstallation côté
 * app, donc on rappelle régulièrement d'exporter, plutôt que de se fier à un seul
 * message au moment de partir.
 */
export function BanniereExport() {
  return (
    <s-banner tone="warning" heading="Pensez à exporter votre livre régulièrement">
      <s-paragraph>
        En cas de désinstallation de l&apos;app, toutes vos données sont supprimées
        48h plus tard (obligation RGPD). Le livre des recettes doit être conservé 10
        ans : exportez-le régulièrement pour le garder de votre côté.
      </s-paragraph>
      <s-button slot="primary-action" href="/app/export">
        Exporter maintenant
      </s-button>
    </s-banner>
  );
}
