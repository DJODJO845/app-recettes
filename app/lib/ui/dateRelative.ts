/** Nombre de jours pleins écoulés depuis `date` (arrondi vers le bas, jamais négatif en pratique ici). */
export function joursDepuis(date: Date, maintenant = new Date()): number {
  return Math.floor((maintenant.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Phrase affichée sur l'écran Export pour situer le dernier export dans le temps,
 * sans avoir à retourner sur le Dashboard pour le savoir (BanniereExport).
 */
export function libelleDernierExport(derniereExportation: Date | null, maintenant = new Date()): string {
  if (!derniereExportation) return "Jamais exporté depuis l'installation de l'app.";

  const jours = joursDepuis(derniereExportation, maintenant);
  if (jours <= 0) return "Dernier export : aujourd'hui.";
  if (jours === 1) return "Dernier export : hier.";
  return `Dernier export : il y a ${jours} jours.`;
}
