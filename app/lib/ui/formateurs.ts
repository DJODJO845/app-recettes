/**
 * Formateurs fr-FR partagés, pour que montants et dates s'affichent de façon
 * identique partout dans l'app (Dashboard, Livre, exports, emails) plutôt que
 * de risquer une dérive entre des instances redéfinies dans chaque fichier.
 */
export const formateurEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const formateurDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
