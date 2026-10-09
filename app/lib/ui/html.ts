/**
 * Échappe une valeur avant de l'insérer dans du HTML généré par concaténation de
 * chaînes (version imprimable, email HTML) — nécessaire pour toute valeur qui peut
 * un jour contenir du texte saisi par un client (ex. son nom Shopify), même si elle
 * ne le peut pas encore aujourd'hui : sans ça, un nom de client contenant du HTML/JS
 * s'exécuterait dans l'onglet du marchand qui ouvre l'export.
 */
export function echapperHTML(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
