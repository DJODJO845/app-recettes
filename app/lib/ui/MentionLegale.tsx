/** Mention légale visible (fonctionnalité 6, V1) : accessible depuis toutes les pages. */
export function MentionLegale() {
  return (
    <s-paragraph>
      <s-text color="subdued">
        Cette app est une aide, elle ne remplace pas un expert-comptable.{" "}
        <s-link href="/app/mentions-legales">Mentions légales</s-link>
        {" · "}
        <s-link href="/politique-confidentialite" target="_blank">
          Politique de confidentialité
        </s-link>
      </s-text>
    </s-paragraph>
  );
}
