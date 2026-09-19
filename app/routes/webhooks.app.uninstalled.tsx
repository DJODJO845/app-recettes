import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, topic, shop } = await authenticate.webhook(request);

  console.log(`Reçu webhook ${topic} pour ${shop}`);

  // Les webhooks peuvent être reçus plusieurs fois, y compris après désinstallation :
  // la session a pu déjà être supprimée par un envoi précédent.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
