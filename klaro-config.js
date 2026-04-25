// Klaro Consent Manager - Konfiguration fuer feminity-oberkassel.de
// Open Source (BSD-3), KIProtect GmbH, https://klaro.org
var klaroConfig = {
  version: 1,
  elementID: 'klaro',
  styling: {
    theme: ['light', 'top', 'wide']
  },
  noAutoLoad: false,
  htmlTexts: true,
  embedded: false,
  groupByPurpose: true,
  storageMethod: 'cookie',
  cookieName: 'klaro-feminity',
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
        description: 'Wir nutzen Drittanbieter-Dienste, um die Wirksamkeit unserer Werbung zu messen (Google Ads). Sie koennen Ihre Auswahl jederzeit aendern oder widerrufen.',
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
        marketing: {
          title: 'Marketing',
          description: 'Dienste, die zur Messung und Optimierung von Werbekampagnen eingesetzt werden.'
        }
      }
    }
  },

  services: [
    {
      name: 'google-ads',
      title: 'Google Ads Conversion Tracking',
      purposes: ['marketing'],
      cookies: [/^_gcl_/i, /^_gac_/i, /^_gads/i],
      required: false,
      default: false,
      description: 'Google Ads (Google Ireland Limited) misst, wie viele Besucher nach einem Klick auf eine Anzeige eine Buchung oder Kontaktaufnahme starten.'
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
