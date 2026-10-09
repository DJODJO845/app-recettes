import { useState } from "react";

/**
 * Affiche toujours la première phrase (l'essentiel de l'alerte), le reste du texte
 * étant replié derrière un volet dépliable — pour qu'une bannière d'alerte ne prenne
 * pas tout l'écran dès l'arrivée sur le Dashboard, sans pour autant perdre le message
 * important.
 */
export function TexteDepliable({ premierePhrase, reste }: { premierePhrase: string; reste: string }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <s-stack direction="block" gap="small-200">
      <s-paragraph>{premierePhrase}</s-paragraph>
      {ouvert && <s-paragraph>{reste}</s-paragraph>}
      <div>
        <s-button
          variant="tertiary"
          icon={ouvert ? "chevron-up" : "chevron-down"}
          onClick={() => setOuvert((valeur) => !valeur)}
        >
          {ouvert ? "Voir moins" : "En savoir plus"}
        </s-button>
      </div>
    </s-stack>
  );
}
