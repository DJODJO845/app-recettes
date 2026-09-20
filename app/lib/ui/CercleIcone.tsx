/**
 * Cercle teinté derrière une icône — seul moyen d'ajouter un accent de couleur
 * sans sortir des fonds neutres imposés par Polaris (cf. app._index.tsx).
 */
export function CercleIcone({
  type,
  tone,
  fond,
}: {
  type: string;
  tone: "success" | "warning" | "critical" | "info";
  fond: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background: fond,
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- l'union IconType n'est pas exportée par le package */}
      <s-icon type={type as any} tone={tone} />
    </div>
  );
}
