import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { useMemo, useRef, useState } from "react";
import { authenticate } from "../shopify.server";
import { listerLignes } from "../lib/db/lignesLivre.server";
import { libelleModeReglement } from "../lib/domain/livreDesRecettes";
import { MentionLegale } from "../lib/ui/MentionLegale";
import type { NatureLigneLivre } from "../lib/domain/types";
import { headersNonMisEnCache } from "../lib/ui/noStoreHeaders";

const NATURE_FILTRES: { value: "TOUTES" | NatureLigneLivre; label: string }[] = [
  { value: "TOUTES", label: "Toutes" },
  { value: "vente", label: "Vente" },
  { value: "vente_carte_cadeau", label: "Vente de carte cadeau" },
  { value: "reglement_carte_cadeau", label: "Règlement par carte cadeau" },
  { value: "remboursement", label: "Remboursement" },
];

const LIBELLES_NATURE: Record<NatureLigneLivre, string> = {
  vente: "Vente",
  vente_carte_cadeau: "Vente de carte cadeau",
  reglement_carte_cadeau: "Règlement par carte cadeau",
  remboursement: "Remboursement",
};

const BADGE_NATURE = {
  vente: { tone: "success", icon: "check-circle-filled" },
  vente_carte_cadeau: { tone: "info", icon: "gift-card" },
  reglement_carte_cadeau: { tone: "info", icon: "gift-card" },
  remboursement: { tone: "critical", icon: "arrow-left" },
} as const satisfies Record<NatureLigneLivre, { tone: "success" | "info" | "critical"; icon: string }>;

const formateurEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const formateurDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const debutParam = url.searchParams.get("debut");
  const finParam = url.searchParams.get("fin");

  const periode =
    debutParam && finParam
      ? { debut: new Date(debutParam), fin: new Date(`${finParam}T23:59:59`) }
      : undefined;

  const lignes = await listerLignes(session.shop, periode);

  return { lignes };
};

export default function LivreDesRecettes() {
  const { lignes } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type du custom element non exposé pour un ref direct
  const debutRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finRef = useRef<any>(null);
  const [natureFiltre, setNatureFiltre] = useState<"TOUTES" | NatureLigneLivre>("TOUTES");
  const [modeFiltre, setModeFiltre] = useState<string>("TOUS");

  const modesDisponibles = useMemo(
    () => Array.from(new Set(lignes.map((ligne) => libelleModeReglement(ligne.modeReglement)))).sort(),
    [lignes],
  );

  const lignesFiltrees = useMemo(
    () =>
      lignes.filter(
        (ligne) =>
          (natureFiltre === "TOUTES" || ligne.nature === natureFiltre) &&
          (modeFiltre === "TOUS" || libelleModeReglement(ligne.modeReglement) === modeFiltre),
      ),
    [lignes, natureFiltre, modeFiltre],
  );

  const total = useMemo(
    () => lignesFiltrees.reduce((somme, ligne) => somme + ligne.montant, 0),
    [lignesFiltrees],
  );

  return (
    <s-page heading="Livre des recettes">
      <s-section heading="Filtrer par période">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-date-field ref={debutRef} label="Du" defaultValue={searchParams.get("debut") ?? ""} />
            <s-date-field ref={finRef} label="Au" defaultValue={searchParams.get("fin") ?? ""} />
          </s-stack>
          <s-stack direction="inline" gap="base">
            <s-select
              label="Nature"
              onChange={(e) => setNatureFiltre(e.currentTarget.value as "TOUTES" | NatureLigneLivre)}
            >
              {NATURE_FILTRES.map((option) => (
                <s-option key={option.value} value={option.value}>
                  {option.label}
                </s-option>
              ))}
            </s-select>
            <s-select label="Mode de règlement" onChange={(e) => setModeFiltre(e.currentTarget.value)}>
              <s-option value="TOUS">Tous</s-option>
              {modesDisponibles.map((mode) => (
                <s-option key={mode} value={mode}>
                  {mode}
                </s-option>
              ))}
            </s-select>
          </s-stack>
          <div>
            <s-button
              onClick={() => {
                const debut = debutRef.current?.value ?? "";
                const fin = finRef.current?.value ?? "";
                if (debut && fin) setSearchParams({ debut, fin });
              }}
            >
              Filtrer par période
            </s-button>
          </div>
        </s-stack>
      </s-section>

      <s-section>
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">{lignesFiltrees.length} ligne(s)</s-text>
          <s-text type="strong" tone="success">Total : {formateurEUR.format(total)}</s-text>
        </s-stack>
      </s-section>

      <s-section>
        {lignesFiltrees.length === 0 ? (
          <s-box padding="large" background="subdued" borderRadius="large">
            <s-stack direction="block" gap="small-200" alignItems="center">
              <s-icon type="book-open" tone="neutral" />
              <s-text color="subdued">Aucune ligne ne correspond à ces filtres.</s-text>
            </s-stack>
          </s-box>
        ) : (
          <s-table variant="list" paginate={false}>
            <s-table-header-row>
              <s-table-header listSlot="primary">Date</s-table-header>
              <s-table-header>Référence</s-table-header>
              <s-table-header>Client</s-table-header>
              <s-table-header>Nature</s-table-header>
              <s-table-header>Mode de règlement</s-table-header>
              <s-table-header>Canal</s-table-header>
              <s-table-header format="currency">Montant</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {lignesFiltrees.map((ligne) => (
                <s-table-row key={ligne.id}>
                  <s-table-cell>{formateurDate.format(new Date(ligne.date))}</s-table-cell>
                  <s-table-cell>{ligne.reference}</s-table-cell>
                  <s-table-cell>{ligne.client}</s-table-cell>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-200">
                      <s-badge tone={BADGE_NATURE[ligne.nature].tone} icon={BADGE_NATURE[ligne.nature].icon}>
                        {LIBELLES_NATURE[ligne.nature]}
                      </s-badge>
                      {!ligne.compteDansCA && (
                        <s-text color="subdued">Déjà comptée à l&apos;achat de la carte</s-text>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{libelleModeReglement(ligne.modeReglement)}</s-table-cell>
                  <s-table-cell>{ligne.canal}</s-table-cell>
                  <s-table-cell>
                    <s-text tone={ligne.montant < 0 ? "critical" : "success"} type="strong">
                      {formateurEUR.format(ligne.montant)}
                    </s-text>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <MentionLegale />
    </s-page>
  );
}

export const headers: HeadersFunction = headersNonMisEnCache;
