// Klaro Consent Manager - Konfiguration fuer feminity-oberkassel.de
// Open Source (BSD-3), KIProtect GmbH, https://klaro.org
var klaroConfig = {
  version: 1,
  elementID: 'klaro',
  styling: {
    theme: ['light', 'bottom', 'wide']
  },
  noAutoLoad: false,
  htmlTexts: true,
  embedded: false,
  groupByPurpose: true,
  storageMethod: 'cookie',
  // Neuer Name seit der Umstellung auf Google Analytics (2026-10-05): Wer
  // frueher "Google Ads" zugestimmt hat, hat nicht in Analytics eingewilligt —
  // mit dem neuen Namen wird jede Besucherin einmal neu gefragt.
  cookieName: 'klaro-feminity-2',
  cookieExpiresAfterDays: 180,
  default: false,
  mustConsent: false,
  acceptAll: true,
  hideDeclineAll: false,
  hideLearnMore: false,
  noticeAsModal: false,
  privacyPolicy: '/impressum.html',

  translations: {
    de: {
      privacyPolicyUrl: '/impressum.html',
      consentNotice: {
        description: 'Mit Ihrer Einwilligung nutzen wir Google Analytics, um zu verstehen, wie unsere Website genutzt wird, und um die Wirkung unserer Werbung zu messen. Sie koennen Ihre Auswahl jederzeit aendern oder widerrufen.',
        learnMore: 'Einstellungen anpassen'
      },
      consentModal: {
        title: 'Datenschutz-Einstellungen',
        description: 'Hier finden Sie eine Uebersicht aller Dienste, die auf dieser Website eingesetzt werden. Sie koennen einzelne Dienste aktivieren oder deaktivieren.'
      },
      ok: 'Alle akzeptieren',
      decline: 'Ablehnen',
      save: 'Auswahl speichern',
      close: 'Schliessen',
      acceptAll: 'Alle akzeptieren',
      acceptSelected: 'Auswahl speichern',
      poweredBy: 'Realisiert mit Klaro!',
      privacyPolicy: {
        text: 'Mehr Informationen finden Sie in unserer {privacyPolicy}.',
        name: 'Datenschutzerklaerung'
      },
      service: {
        disableAll: {
          title: 'Alle Dienste aktivieren oder deaktivieren',
          description: 'Schalter, um alle Dienste auf einmal zu aktivieren oder zu deaktivieren.'
        },
        optOut: {
          title: '(Opt-out)',
          description: 'Dieser Dienst ist standardmaessig aktiv. Sie koennen ihn hier deaktivieren.'
        },
        required: {
          title: '(Erforderlich)',
          description: 'Dieser Dienst ist fuer den Betrieb der Website notwendig und kann nicht deaktiviert werden.'
        },
        purposes: 'Zwecke',
        purpose: 'Zweck'
      },
      purposes: {
        statistik: {
          title: 'Statistik',
          description: 'Dienste, die anonym bzw. pseudonym auswerten, wie Besucher unsere Website nutzen.'
        },
        marketing: {
          title: 'Marketing',
          description: 'Dienste, die zur Messung und Optimierung von Werbekampagnen eingesetzt werden.'
        }
      }
    }
  },

  services: [
    {
      name: 'google-analytics',
      title: 'Google Analytics',
      purposes: ['statistik', 'marketing'],
      cookies: [/^_ga/i, /^_gid/i, /^_gcl_/i, /^_gac_/i],
      required: false,
      default: false,
      description: 'Google Analytics 4 (Google Ireland Limited) wertet pseudonym aus, welche Seiten besucht und wie oft z. B. „Termin buchen“ geklickt wird; bei verknuepftem Google-Ads-Konto auch, wie viele Besucher nach einem Klick auf eine Anzeige buchen. Daten koennen an Google LLC in den USA uebermittelt werden.'
    }
  ]
};

// Globale Helfer-Funktion fuer Buchungs-Klicks
// Treatwell ist fuer die Kernfunktion (Terminbuchung) erforderlich und basiert
// auf einer expliziten User-Aktion (Art. 6 Abs. 1 lit. b DSGVO).
function handleBookingClick(closeMenuFn) {
  if (typeof closeMenuFn === 'function') {
    closeMenuFn();
  }
  if (typeof wahanda !== 'undefined' && wahanda.openOnlineBookingWidget) {
    wahanda.openOnlineBookingWidget('https://buchung.treatwell.de/ort/516512/menue/');
  } else {
    // Fallback falls das Treatwell-Skript noch nicht geladen wurde
    window.location.href = 'https://buchung.treatwell.de/ort/516512/menue/';
  }
  return false;
}
