// Bestätigungen des Hairtalk-Bogens — einzige Quelle für Formular UND PDF.
//
// Wortlaut übernommen aus dem Merkblatt „Hairtalk Tape-In Extensions" des
// Salons (Abschnitt „Einwilligung und Bestätigung"). Anders als bei den
// Gesundheitsbögen sind das keine Fragen mit Ja oder Nein, sondern
// Bestätigungen: Jede einzelne muss angekreuzt werden, sonst ist die
// Aufklärung nicht erteilt.
//
// Diese Datei wird zweimal geladen: im Browser über <script src> und auf dem
// Server über require(). Wortlaut ändern: nur hier. Die `id` stehen lassen —
// sie ist der Schlüssel in der Übertragung.

(function (global) {
  'use strict';

  // Angaben zur geplanten Behandlung, aus Abschnitt B des Merkblatts
  var BEHANDLUNG = [
    { id: 'qualitaet', name: 'Qualität / Länge / Farbe' },
    { id: 'tressen', name: 'Anzahl Tressen' },
    { id: 'einsetztermin', name: 'Termin zum Einsetzen' },
    { id: 'stylistin', name: 'Stylistin', standard: 'Evelin' },
  ];

  var BESTAETIGUNGEN = [
    {
      id: 'merkblatt',
      text: 'Ich habe das Merkblatt „Hairtalk Tape-In Extensions" erhalten, gelesen und '
        + 'verstanden. Alle meine Fragen wurden beantwortet.',
    },
    {
      id: 'terminablauf',
      text: 'Mir ist bekannt, dass online ausschließlich der Beratungstermin gebucht werden '
        + 'kann und ein Einsetztermin erst nach Beratung und Bestellung vergeben wird.',
    },
    {
      id: 'bestellung',
      text: 'Das Material wird nach meiner verbindlichen Zusage individuell und exklusiv für '
        + 'mich bestellt.',
    },
    {
      id: 'waschen',
      text: 'Ich wurde darauf hingewiesen, dass das Haar in den ersten 48 Stunden nach dem '
        + 'Einsetzen nicht shampooniert werden darf.',
    },
    {
      id: 'pflege',
      text: 'Ich verwende ausschließlich die von Hairtalk empfohlenen Pflegeprodukte. Mir ist '
        + 'bekannt, dass bei Verwendung anderer Produkte keine Gewährleistung für Zustand und '
        + 'Haltbarkeit übernommen werden kann.',
    },
    {
      id: 'eigenmaterial',
      text: 'Mir ist bekannt, dass Feminity Oberkassel ausschließlich mit eigenen Haaren und '
        + 'Tressen arbeitet, keine Fremdarbeit einsetzt und keine Extensions anderer Salons '
        + 'hochsetzt.',
    },
    {
      id: 'kontrolle',
      text: 'Ich nehme die vereinbarten Kontroll- und Wechseltermine wahr und melde '
        + 'Veränderungen an Kopfhaut oder Verbindungsstellen unverzüglich im Salon.',
    },
  ];

  var katalog = { BEHANDLUNG: BEHANDLUNG, BESTAETIGUNGEN: BESTAETIGUNGEN };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = katalog;      // Server
  } else {
    global.HAIRTALK = katalog;     // Browser
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
