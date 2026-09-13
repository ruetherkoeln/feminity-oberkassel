// Fragenkatalog des Massage-Bogens — einzige Quelle für Formular UND PDF.
//
// Zusammengestellt nach den üblichen Kontraindikationen einer Wellness-Massage,
// zugeschnitten auf die drei Angebote des Salons:
//   Hot Stone  → Wärme: Wärmeempfindlichkeit, Diabetes (Sensibilität), Implantate
//   Aroma      → Öle und Duftstoffe: Allergien
//   Kräuterstempel → Kräuter und Wärme: Allergien, Wärmeempfindlichkeit
//
// Die Fragen sind Ausschlussgründe oder Anlass zur Rücksprache — keine
// medizinische Diagnostik. Der Bogen ersetzt keine ärztliche Abklärung.
//
// Diese Datei wird zweimal geladen: im Browser über <script src> und auf dem
// Server über require(). Fragen ändern: nur hier. Die `id` stehen lassen —
// sie ist der Schlüssel in der Übertragung.

(function (global) {
  'use strict';

  var MASSAGEN = [
    { id: 'aroma', name: 'Aroma-Massage' },
    { id: 'hotstone', name: 'Hot Stone' },
    { id: 'kraeuterstempel', name: 'Kräuterstempel' },
    { id: 'klassisch', name: 'Klassische Massage' },
  ];

  var DRUCK = [
    { id: 'sanft', name: 'sanft' },
    { id: 'mittel', name: 'mittel' },
    { id: 'kraeftig', name: 'kräftig' },
  ];

  var GRUPPEN = [
    {
      titel: 'Akut',
      fragen: [
        { id: 'entzuendung', frage: 'Akute Entzündung, Fieber oder Infekt' },
        { id: 'verletzung', frage: 'Frische Verletzung oder Operation in den letzten sechs Monaten',
          detail: 'Wo?' },
        { id: 'hautstelle', frage: 'Hauterkrankung, offene Wunde oder Sonnenbrand im Massagebereich' },
        { id: 'ruecken', frage: 'Bandscheibenvorfall oder akute Rückenbeschwerden' },
      ],
    },
    {
      titel: 'Kreislauf und Blut',
      fragen: [
        { id: 'thrombose', frage: 'Thrombose, Venenerkrankung oder Krampfadern' },
        { id: 'herz', frage: 'Herz-Kreislauf-Erkrankung oder Bluthochdruck' },
        { id: 'blutverduenner', frage: 'Blutverdünnende Mittel (z. B. Marcumar, ASS)' },
        { id: 'implantate', frage: 'Herzschrittmacher oder Implantate' },
      ],
    },
    {
      titel: 'Erkrankungen',
      fragen: [
        { id: 'diabetes', frage: 'Diabetes' },
        { id: 'osteoporose', frage: 'Osteoporose' },
        { id: 'krebs', frage: 'Krebserkrankung oder laufende Therapie' },
        { id: 'epilepsie', frage: 'Epilepsie' },
        { id: 'schilddruese', frage: 'Schilddrüsenerkrankung' },
      ],
    },
    {
      titel: 'Vor der Behandlung',
      fragen: [
        { id: 'schwanger', frage: 'Schwangerschaft oder Stillzeit', detail: 'In welcher Woche?' },
        { id: 'allergien', frage: 'Allergie gegen Öle, Duftstoffe oder Kräuter',
          detail: 'Wogegen?' },
        { id: 'waerme', frage: 'Empfindlichkeit gegenüber Wärme' },
        { id: 'medikamente', frage: 'Regelmäßige Einnahme von Medikamenten', detail: 'Welche?' },
      ],
    },
  ];

  var ALLE = [];
  for (var i = 0; i < GRUPPEN.length; i++) {
    for (var j = 0; j < GRUPPEN[i].fragen.length; j++) ALLE.push(GRUPPEN[i].fragen[j]);
  }

  var katalog = { MASSAGEN: MASSAGEN, DRUCK: DRUCK, GRUPPEN: GRUPPEN, ALLE: ALLE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = katalog;      // Server
  } else {
    global.MASSAGE = katalog;      // Browser
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
