// Fragenkatalog des Gesundheitsfragebogens — einzige Quelle für Formular UND PDF.
//
// Wortlaut übernommen vom Papierbogen des Salons (GESUNDHEITSFRAGEBOGEN.pdf),
// damit der digitale Bogen dasselbe fragt wie der bisherige. Fragen ändern:
// nur hier. Die `id` dagegen stehen lassen — sie ist der Schlüssel in der
// Übertragung, und bereits verschickte Bögen beziehen sich darauf.
//
// Diese Datei wird zweimal geladen: im Browser über <script src>, um die
// Fragen im Formular zu erzeugen, und auf dem Server über require(), um sie
// ins PDF zu schreiben. Deshalb der doppelte Export unten. Stünde die Liste
// an zwei Stellen, liefe der unterschriebene Bogen früher oder später dem
// auseinander, was die Person auf dem Bildschirm gesehen hat.

(function (global) {
  'use strict';

  // Mehrfachauswahl — auf dem Papierbogen sind es einzeln ankreuzbare Kästchen,
  // "empfindlich" und "zu Unreinheiten neigend" treten neben die Grundtypen.
  var HAUTZUSTAND = [
    { id: 'normal', name: 'normal' },
    { id: 'trocken', name: 'trocken' },
    { id: 'fettig', name: 'fettig' },
    { id: 'mischhaut', name: 'Mischhaut' },
    { id: 'empfindlich', name: 'empfindlich' },
    { id: 'unreinheiten', name: 'zu Unreinheiten neigend' },
  ];

  var FRAGEN = [
    { id: 'hautkrankheiten', frage: 'Leiden Sie an Hautkrankheiten?', detail: 'Wenn ja, welche?' },
    { id: 'allergien', frage: 'Haben Sie Allergien?', detail: 'Wenn ja, welche?' },
    { id: 'medikamente', frage: 'Nehmen Sie aktuell Medikamente ein?', detail: 'Wenn ja, welche?' },
    { id: 'schwanger', frage: 'Sind Sie schwanger oder stillen Sie?' },
  ];

  var katalog = { HAUTZUSTAND: HAUTZUSTAND, FRAGEN: FRAGEN };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = katalog;          // Server
  } else {
    global.GESUNDHEIT = katalog;       // Browser
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
