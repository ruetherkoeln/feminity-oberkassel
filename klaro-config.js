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
        description: 'Wir nutzen Cookies und Drittanbieter-Dienste, um diese Website zu betreiben (z.B. Online-Buchung ueber Treatwell) und um die Wirksamkeit unserer Werbung zu messen (Google Ads). Sie koennen Ihre Auswahl jederzeit aendern oder widerrufen.',
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
        functional: {
          title: 'Funktional',
          description: 'Dienste, die fuer Funktionen der Website erforderlich sind, z.B. Online-Buchung.'
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
      name: 'treatwell',
      title: 'Treatwell Online-Buchung',
      purposes: ['functional'],
      cookies: [
        [/^treatwell/i, '/', '.treatwell.de'],
        [/^wahanda/i, '/', '.treatwell.de']
      ],
      required: false,
      default: false,
      description: 'Buchungs-Widget von Treatwell (Wahanda Ltd., London). Wird beim Klick auf "Jetzt Termin buchen" geladen und ermoeglicht die Online-Terminbuchung.'
    },
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

// Globale Helfer-Funktion fuer Klaro-kontrollierte Buchungs-Klicks
function handleBookingClick(closeMenuFn) {
  if (typeof closeMenuFn === 'function') {
    closeMenuFn();
  }
  var manager = (typeof klaro !== 'undefined') ? klaro.getManager(klaroConfig) : null;
  var hasConsent = manager && manager.getConsent('treatwell');
  if (hasConsent && typeof wahanda !== 'undefined') {
    wahanda.openOnlineBookingWidget('https://buchung.treatwell.de/ort/516512/menue/');
  } else if (typeof klaro !== 'undefined') {
    klaro.show(klaroConfig);
  } else {
    // Fallback falls Klaro nicht geladen werden konnte
    window.location.href = 'https://buchung.treatwell.de/ort/516512/menue/';
  }
  return false;
}

// Treatwell-Widget-Skript dynamisch nachladen, sobald Consent erteilt wurde
window.addEventListener('load', function () {
  if (typeof klaro === 'undefined') return;
  var manager = klaro.getManager(klaroConfig);
  manager.watch({
    update: function (obj, name, data) {
      if (name === 'consents' && data.treatwell && typeof wahanda === 'undefined') {
        var s = document.createElement('script');
        s.src = 'https://www.treatwell.de/widgets/wahanda.js';
        s.async = true;
        document.body.appendChild(s);
      }
    }
  });
});
