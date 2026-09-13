// Fragenkatalog des Gesundheitsfragebogens — einzige Quelle für Formular UND PDF.
//
// Diese Datei wird zweimal geladen: im Browser über <script src>, um die
// Fragen im Formular zu erzeugen, und auf dem Server über require(), um sie
// ins PDF zu schreiben. Deshalb der doppelte Export unten. Würde die Liste
// an zwei Stellen stehen, liefe der unterschriebene Bogen früher oder später
// dem auseinander, was die Person auf dem Bildschirm gesehen hat.
//
// Aufbau eines Eintrags:
//   id      Schlüssel in der Übertragung — nicht ändern, sonst passen
//           gespeicherte Bögen nicht mehr dazu
//   frage   Wortlaut, wie er im Formular und im PDF erscheint
//   detail  optional: Beschriftung eines Textfelds, das bei "Ja" erscheint

(function (global) {
  'use strict';

  var BEHANDLUNGEN = [
    { id: 'pmu', name: 'Permanent Make-up' },
    { id: 'laser', name: 'Laser-Haarentfernung' },
    { id: 'drip', name: 'Beauty Drip / NAD+ Infusion' },
    { id: 'peeling', name: 'Green Peel / Peeling' },
    { id: 'liposana', name: 'LIPOSANA3' },
    { id: 'massage', name: 'Massage' },
    { id: 'sonstige', name: 'Sonstige Behandlung' },
  ];

  var GRUPPEN = [
    {
      titel: 'Allgemein',
      fragen: [
        { id: 'schwangerschaft', frage: 'Schwangerschaft oder Stillzeit' },
        { id: 'medikamente', frage: 'Regelmäßige Einnahme von Medikamenten', detail: 'Welche?' },
        { id: 'blutverduenner', frage: 'Blutverdünnende Mittel (z. B. Marcumar, ASS)' },
        { id: 'allergien', frage: 'Allergien oder Unverträglichkeiten', detail: 'Wogegen?' },
        { id: 'infektion', frage: 'Infektionskrankheiten (z. B. Hepatitis, HIV)' },
      ],
    },
    {
      titel: 'Erkrankungen',
      fragen: [
        { id: 'diabetes', frage: 'Diabetes' },
        { id: 'herz', frage: 'Herz-Kreislauf-Erkrankung oder Bluthochdruck' },
        { id: 'schilddruese', frage: 'Schilddrüsenerkrankung' },
        { id: 'epilepsie', frage: 'Epilepsie' },
        { id: 'autoimmun', frage: 'Autoimmunerkrankung' },
        { id: 'krebs', frage: 'Krebserkrankung oder laufende Therapie' },
        { id: 'nierenleber', frage: 'Nieren- oder Lebererkrankung' },
      ],
    },
    {
      titel: 'Haut und Heilung',
      fragen: [
        { id: 'haut', frage: 'Hauterkrankung im Behandlungsbereich (z. B. Neurodermitis, Schuppenflechte)' },
        { id: 'wundheilung', frage: 'Neigung zu Wundheilungsstörungen oder Wulstnarben' },
        { id: 'herpes', frage: 'Neigung zu Lippenherpes' },
        { id: 'isotretinoin', frage: 'Aknemittel mit Isotretinoin in den letzten sechs Monaten' },
        { id: 'sonne', frage: 'Sonnenbad oder Solarium in den letzten 14 Tagen' },
      ],
    },
    {
      titel: 'Sonstiges',
      fragen: [
        { id: 'implantate', frage: 'Herzschrittmacher, Implantate oder Metall im Behandlungsbereich' },
        { id: 'unterspritzung', frage: 'Botox oder Filler in den letzten vier Wochen' },
        { id: 'weiteres', frage: 'Weitere gesundheitliche Einschränkungen', detail: 'Welche?' },
      ],
    },
  ];

  // Flache Liste für Prüfung und PDF
  var ALLE = [];
  for (var i = 0; i < GRUPPEN.length; i++) {
    for (var j = 0; j < GRUPPEN[i].fragen.length; j++) ALLE.push(GRUPPEN[i].fragen[j]);
  }

  var katalog = { BEHANDLUNGEN: BEHANDLUNGEN, GRUPPEN: GRUPPEN, ALLE: ALLE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = katalog;          // Server
  } else {
    global.GESUNDHEIT = katalog;       // Browser
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
