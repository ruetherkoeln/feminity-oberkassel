// Absenden eines Bogens — mit Wiederholung bei vorübergehenden Störungen.
//
// Warum es das gibt: Am 13.09.2026 hat IONOS die Zustellung an unser eigenes
// Postfach eine halbe Stunde lang verweigert, nachdem in kurzer Folge viele
// Nachrichten dorthin gingen. Ein Gast haette in dem Moment ausgefuellt,
// unterschrieben — und eine Fehlermeldung bekommen, waehrend sein Bogen
// verloren gewesen waere.
//
// Die Serverfunktion wiederholt bereits einmal nach 1,5 Sekunden. Das deckt
// einen kurzen Aussetzer ab, keine Sperre ueber Minuten. Deshalb hier: drei
// Minuten lang alle 30 Sekunden erneut versuchen, sichtbar fuer den Salon.
//
// Die Angaben bleiben dabei ausschliesslich im Arbeitsspeicher der offenen
// Seite. Bewusst nicht in sessionStorage oder localStorage: Das Tablet geht
// von Hand zu Hand, und Gesundheitsdaten haben dort nichts abgelegt zu
// bleiben. Preis dafuer: Wird die Seite geschlossen, ist der Bogen weg.

(function (global) {
  'use strict';

  var FRIST_MS = 180000;    // drei Minuten, vom Benutzer so gewaehlt
  var ABSTAND_MS = 30000;   // zwischen zwei Versuchen

  // Fehler, die sich durch Warten nicht beheben: fehlende Angaben, fehlende
  // Einwilligung, fehlende Konfiguration. Wiederholen waere hier nur Zeitverlust.
  var ENDGUELTIG = [
    'pflicht', 'signatur', 'einwilligung', 'unvollstaendig', 'vertreter',
    'mobil', 'kontaktweg', 'konfiguration', 'pdf',
  ];

  /**
   * daten: die Nutzlast des Bogens
   * rueck: { erfolg(), wartet(sekundenBisVersuch, verbleibendeSekunden, versuch),
   *          fehler(code, fristAbgelaufen) }
   * Rueckgabe: { abbrechen() }
   */
  function absenden(daten, rueck) {
    var start = Date.now();
    var versuch = 0;
    var uhr = null;      // Sekundentakt fuer die Anzeige
    var wecker = null;   // Zeitgeber fuer den naechsten Versuch
    var abgebrochen = false;

    function verbleibend() {
      return Math.max(0, FRIST_MS - (Date.now() - start));
    }

    function einVersuch() {
      if (abgebrochen) return;
      versuch++;
      fetch('/api/fragebogen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten),
      })
        .then(function (a) {
          return a.json().catch(function () { return {}; });
        })
        .then(function (a) {
          if (abgebrochen) return;
          if (a.ok) return rueck.erfolg();
          if (ENDGUELTIG.indexOf(a.fehler) >= 0) return rueck.fehler(a.fehler, false);
          nachlegen(a.fehler || 'versand');
        })
        .catch(function () {
          // Netzfehler — das WLAN im Salon, ein Zeitablauf. Auch das vergeht.
          if (!abgebrochen) nachlegen('versand');
        });
    }

    function nachlegen(grund) {
      var rest = verbleibend();
      if (rest <= 0) return rueck.fehler(grund, true);
      var wartezeit = Math.min(ABSTAND_MS, rest);
      var bis = Date.now() + wartezeit;

      // Zwei getrennte Taktgeber, und das mit Absicht: Der Zeitgeber loest den
      // naechsten Versuch aus, der Sekundentakt aktualisiert nur die Anzeige.
      // Beides in einen zu legen hiesse, dass eine Wartezeit unter einer
      // Sekunde erst nach einer ganzen Sekunde ablaufen wuerde.
      wecker = setTimeout(function () {
        clearInterval(uhr);
        uhr = null;
        einVersuch();
      }, wartezeit);

      // Ein stiller Spinner sieht im Salon nach Absturz aus — es soll zaehlen.
      uhr = setInterval(function () {
        if (abgebrochen) return;
        var nochMs = Math.max(0, bis - Date.now());
        rueck.wartet(Math.ceil(nochMs / 1000), Math.ceil(verbleibend() / 1000), versuch);
      }, 1000);

      rueck.wartet(Math.ceil(wartezeit / 1000), Math.ceil(rest / 1000), versuch);
    }

    einVersuch();

    return {
      abbrechen: function () {
        abgebrochen = true;
        if (uhr) clearInterval(uhr);
        if (wecker) clearTimeout(wecker);
      },
    };
  }

  global.ABSENDEN = { absenden: absenden, FRIST_MS: FRIST_MS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
