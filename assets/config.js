/*
 * Zentrale Einstellungen der Vorschau.
 * teamshop: Adresse des Teamshops. Leer lassen, solange es noch keinen Link gibt.
 */
(function () {
  'use strict';
  window.FAL_CONFIG = {
    teamshop: '',
    /* true = fussball.de-Widgets erst nach Klick laden (Zwei-Klick-Lösung), false = sofort laden */
    fdConsent: false
  };

  /* Werte, die jede Seite in ihren Vorlagen als {{ … }} nutzen kann */
  var shop = window.FAL_CONFIG.teamshop;
  window.FAL_GLOBALS = {
    shopHref: shop || '#',
    shopTarget: shop ? '_blank' : '',
    shopRel: shop ? 'noopener' : ''
  };
})();
