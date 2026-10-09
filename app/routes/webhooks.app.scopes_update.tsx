import type { ActionFunctionArgs } from "react-router";
import { authenticateWebhook } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticateWebhook(request);
  console.log(`Reçu webhook ${topic} pour ${shop}`);

  // payload est absent si authenticateWebhook() est retombé sur le filet (échec du
  // rafraîchissement de token) : rien à mettre à jour dans ce cas, pas de session.
  const current = (payload as { current?: string[] } | null)?.current;
  if (session && current) {
    await db.session.update({
      where: { id: session.id },
      data: { scope: current.toString() },
    });
  }
  return new Response();
};
