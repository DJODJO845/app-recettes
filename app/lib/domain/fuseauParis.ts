/**
 * Calculs de dates en fuseau Europe/Paris, jamais en UTC ni en heure serveur.
 *
 * Pourquoi ça compte : les périodes de déclaration URSSAF (mois, trimestre, année)
 * sont des notions calendaires françaises. Le serveur (Render) tourne en UTC. Sans
 * cette correction, une vente encaissée par exemple à 00h30 heure de Paris le 1er
 * octobre serait vue côté serveur comme survenue le 30 septembre à 22h30 UTC (hiver)
 * — et donc comptée dans le mauvais trimestre, avec un mauvais total affiché au
 * marchand. Le décalage Paris/UTC change aussi selon l'heure d'été/hiver (+1h ou +2h),
 * d'où l'usage de l'API Intl (qui connaît les règles de changement d'heure) plutôt
 * qu'un décalage fixe codé en dur.
 */

const FUSEAU = "Europe/Paris";

export interface ComposantesDate {
  annee: number;
  /** 0-indexé (0 = janvier), comme Date.UTC et getUTCMonth. */
  mois: number;
  jour: number;
}

/** Année/mois/jour d'une date donnée, tels qu'affichés en heure de Paris (pas UTC). */
export function composantesParis(date: Date): ComposantesDate {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: FUSEAU,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(date)
      .map((partie) => [partie.type, partie.value]),
  );
  return { annee: Number(parties.year), mois: Number(parties.month) - 1, jour: Number(parties.day) };
}

/**
 * Instant UTC correspondant à une date/heure donnée en heure locale de Paris.
 * Technique standard sans dépendance externe : on part d'une estimation UTC, on
 * regarde quelle heure de Paris cette estimation représente réellement, puis on
 * corrige par l'écart constaté (qui inclut automatiquement l'heure d'été/hiver).
 */
function instantParis(
  annee: number,
  moisIndex0: number,
  jour: number,
  heure: number,
  minute: number,
  seconde: number,
  milliseconde: number,
): Date {
  const estimation = new Date(Date.UTC(annee, moisIndex0, jour, heure, minute, seconde, milliseconde));

  const parties = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: FUSEAU,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(estimation)
      .map((partie) => [partie.type, partie.value]),
  );

  const heureParisDeLEstimation = Date.UTC(
    Number(parties.year),
    Number(parties.month) - 1,
    Number(parties.day),
    Number(parties.hour),
    Number(parties.minute),
    Number(parties.second),
    milliseconde,
  );

  const decalageMs = heureParisDeLEstimation - estimation.getTime();
  return new Date(estimation.getTime() - decalageMs);
}

/** Instant UTC du tout début (00:00:00.000) d'un jour donné, en heure de Paris. */
export function debutDeJourParis(annee: number, moisIndex0: number, jour: number): Date {
  return instantParis(annee, moisIndex0, jour, 0, 0, 0, 0);
}

/** Instant UTC de la toute fin (23:59:59.999) d'un jour donné, en heure de Paris. */
export function finDeJourParis(annee: number, moisIndex0: number, jour: number): Date {
  return instantParis(annee, moisIndex0, jour, 23, 59, 59, 999);
}

/**
 * Composantes année/mois/jour du jour calendaire précédent, par arithmétique de
 * calendrier pure (jamais par soustraction de millisecondes) : un jour calendaire
 * reste "le jour d'avant" même les jours de changement d'heure, où l'écart réel en
 * heures n'est pas 24 — Date.UTC gère nativement le passage au mois/à l'année
 * précédente quand jour vaut 0 ou moins.
 */
export function veilleCalendaire(composantes: ComposantesDate): ComposantesDate {
  const normalisee = new Date(Date.UTC(composantes.annee, composantes.mois, composantes.jour - 1));
  return { annee: normalisee.getUTCFullYear(), mois: normalisee.getUTCMonth(), jour: normalisee.getUTCDate() };
}

/** Nombre de jours dans un mois donné (annee/moisIndex0), indépendant du fuseau. */
export function nombreJoursDuMois(annee: number, moisIndex0: number): number {
  return new Date(Date.UTC(annee, moisIndex0 + 1, 0)).getUTCDate();
}

/**
 * Représentation "YYYY-MM-DD" d'une date en heure de Paris, pour préremplir un
 * `<s-date-field>` (qui attend ce format) sans utiliser `.toISOString()` — celle-ci
 * donnerait la date UTC, pas la date française (elles diffèrent selon l'heure).
 */
export function dateISOParis(date: Date): string {
  const { annee, mois, jour } = composantesParis(date);
  return `${annee}-${String(mois + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/**
 * Inverse de dateISOParis : parse une chaîne "YYYY-MM-DD" (telle que renvoyée par
 * `<s-date-field>`) en un triplet utilisable directement avec debutDeJourParis /
 * finDeJourParis, ex. `debutDeJourParis(...parseDateISO(valeur))`.
 */
export function parseDateISO(iso: string): [annee: number, moisIndex0: number, jour: number] {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!correspondance) {
    throw new Error(`Date invalide, format "YYYY-MM-DD" attendu : "${iso}"`);
  }
  const [, annee, mois, jour] = correspondance;
  return [Number(annee), Number(mois) - 1, Number(jour)];
}
