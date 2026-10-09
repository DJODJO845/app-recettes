/**
 * Formateurs fr-FR partagés, pour que montants et dates s'affichent de façon
 * identique partout dans l'app (Dashboard, Livre, exports, emails) plutôt que
 * de risquer une dérive entre des instances redéfinies dans chaque fichier.
 */
export const formateurEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

// timeZone explicite : sans ça, l'affichage suit le fuseau du serveur (UTC sur
// Render), pas celui du marchand. Une vente encaissée à 00h30 heure de Paris
// s'afficherait alors avec la date de la veille — incohérent avec la période
// dans laquelle elle est comptée (voir lib/domain/fuseauParis.ts).
export const formateurDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });
