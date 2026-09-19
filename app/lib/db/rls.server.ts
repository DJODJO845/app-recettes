import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../../db.server";

type Transaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Exécute `fn` dans une transaction où la variable de session Postgres
 * `app.current_shop` est fixée à `shopDomain`, pour que les politiques RLS
 * (prisma/rls.sql) filtrent automatiquement — filet de sécurité en plus du
 * filtrage applicatif explicite fait dans chaque requête Prisma ci-dessous.
 */
export function executerAvecContexteBoutique<T>(
  shopDomain: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_shop', $1, true)`, shopDomain);
    return fn(tx);
  });
}

export type { Prisma };
