import type { LoaderFunctionArgs } from "react-router";

// TEMPORAIRE — diagnostic Phase 4 : contenu minimal pour isoler la cause de
// la page blanche (voir docs/phase-4-test-reel.md pour le suivi).
export const loader = async (_args: LoaderFunctionArgs) => {
  return new Response("TEST12345", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
