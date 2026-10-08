import type { ActionFunctionArgs } from "react-router";
import type { NiveauAlerte } from "@prisma/client";
import prisma from "../db.server";
import { calculerTotauxDashboard } from "../lib/db/totaux.server";
import { resoudreEmailBoutique } from "../lib/shopify/emailBoutique.server";
import { envoyerEmail } from "../lib/email/resend.server";
import { plafondAnnuel, type NiveauAlertePlafond } from "../lib/domain/reglementation";
import { formateurEUR } from "../lib/ui/formateurs";

const RANG: Record<NiveauAlertePlafond, number> = { ok: 0, avertissement: 1, critique: 2 };
const VERS_PRISMA: Record<NiveauAlertePlafond, NiveauAlerte> = {
  ok: "OK",
  avertissement: "AVERTISSEMENT",
  critique: "CRITIQUE",
};
const DEPUIS_PRISMA: Record<NiveauAlerte, NiveauAlertePlafond> = {
  OK: "ok",
  AVERTISSEMENT: "avertissement",
  CRITIQUE: "critique",
};

/**
 * Appelée une fois par jour par un déclencheur externe (workflow GitHub Actions),
 * même principe que api.cron.rappels-echeance.tsx. Envoie un email quand le CA
 * annuel encaissé franchit à la hausse un seuil d'alerte (80 %, 95 %) — jamais deux
 * fois pour le même niveau, grâce à Boutique.derniereAlertePlafondNiveau. Si le CA
 * annuel repasse sous un seuil (nouvelle année civile), on réarme silencieusement
 * sans email, pour que la prochaine hausse notifie de nouveau.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const boutiques = await prisma.boutique.findMany();
  let envoyes = 0;
  const erreurs: string[] = [];

  for (const boutique of boutiques) {
    try {
      const totaux = await calculerTotauxDashboard(boutique.shopDomain, boutique.periodicite, boutique.typeActivite);
      const niveauActuel = totaux.niveauAlerte;
      const niveauDejaNotifie = DEPUIS_PRISMA[boutique.derniereAlertePlafondNiveau];

      if (niveauActuel === niveauDejaNotifie) continue;

      if (RANG[niveauActuel] < RANG[niveauDejaNotifie]) {
        await prisma.boutique.update({
          where: { shopDomain: boutique.shopDomain },
          data: { derniereAlertePlafondNiveau: VERS_PRISMA[niveauActuel] },
        });
        continue;
      }

      if (niveauActuel === "ok") continue;

      const email = await resoudreEmailBoutique(boutique.shopDomain, boutique.emailRappel);
      if (!email) continue;

      const plafond = plafondAnnuel(boutique.typeActivite.toLowerCase() as "commerce" | "services" | "mixte");
      const pourcentage = Math.round((totaux.caAnnuelEncaisse / plafond) * 100);
      const montantCA = formateurEUR.format(totaux.caAnnuelEncaisse);
      const montantPlafond = formateurEUR.format(plafond);
      const urgent = niveauActuel === "critique";

      await envoyerEmail({
        destinataire: email,
        sujet: urgent
          ? `⚠️ Vous approchez du plafond URSSAF (${pourcentage} %)`
          : `Vous avez dépassé 80 % de votre plafond URSSAF`,
        texte:
          `Votre chiffre d'affaires encaissé depuis le 1er janvier atteint ${montantCA}, ` +
          `soit ${pourcentage} % de votre plafond annuel (${montantPlafond}).\n\n` +
          (urgent
            ? "Vous êtes très proche du plafond : au-delà, vous perdez le statut de micro-entrepreneur.\n\n"
            : "") +
          `Retrouvez le détail dans l'app Recettes URSSAF.`,
        html:
          `<p>Votre chiffre d'affaires encaissé depuis le 1er janvier atteint <strong>${montantCA}</strong>, ` +
          `soit <strong>${pourcentage} %</strong> de votre plafond annuel (${montantPlafond}).</p>` +
          (urgent
            ? `<p><strong>Vous êtes très proche du plafond</strong> : au-delà, vous perdez le statut de micro-entrepreneur.</p>`
            : "") +
          `<p>Retrouvez le détail dans l'app Recettes URSSAF.</p>`,
      });

      await prisma.boutique.update({
        where: { shopDomain: boutique.shopDomain },
        data: { derniereAlertePlafondNiveau: VERS_PRISMA[niveauActuel] },
      });
      envoyes++;
    } catch (erreur) {
      console.error(`Échec de l'alerte de plafond pour ${boutique.shopDomain} :`, erreur);
      erreurs.push(boutique.shopDomain);
    }
  }

  return { envoyes, erreurs };
};
