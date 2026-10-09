import type { LoaderFunctionArgs } from "react-router";
import { authenticateAdmin } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateAdmin(request);

  return null;
};
