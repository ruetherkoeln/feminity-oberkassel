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
    // Bewerberbereich (/api/bewerbung)
    'position', 'email', 'iban', 'steuerid', 'svnummer',
    'dateien', 'datei', 'zuviele', 'zugross', 'kenntnis',
  ];

  /**
   * daten: die Nutzlast des Bogens
   * rueck: { erfolg(), wartet(sekundenBisVersuch, verbleibendeSekunden, versuch),
   *          fehler(code, fristAbgelaufen) }
   * ziel:  Adresse der Serverfunktion, Standard /api/fragebogen
   * Rueckgabe: { abbrechen() }
   */
  function absenden(daten, rueck, ziel) {
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
      fetch(ziel || '/api/fragebogen', {
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

  // ── Rückfallweg fürs Team ────────────────────────────────────────────────
  // Ist der Versand endgültig gescheitert, kann das Team den Bogen als PDF
  // sichern, statt ihn verloren zu geben. Der Knopf ist für Gäste unsichtbar:
  // Er erscheint erst, wenn man zwei Sekunden auf die Fehlermeldung drückt.
  // Grund: Das Tablet geht von Hand zu Hand; ein Gast soll das PDF mit seinen
  // Gesundheitsdaten nicht arglos darauf ablegen.
  //
  // Der Server baut das PDF wie beim Versand, gibt es aber zurück, statt es zu
  // mailen (nurPdf). Es wird nur geöffnet, nicht automatisch gespeichert —
  // drucken oder weiterleiten entscheidet das Team.
  var DRUECKEN_MS = 2000;

  function rueckfallAnbieten(meldung, daten, ziel) {
    var angebot = { daten: daten, text: meldung.textContent };
    meldung._rueckfall = angebot;
    if (meldung._rueckfallBereit) return;   // Lauscher nur einmal anlegen
    meldung._rueckfallBereit = true;

    // Langes Drücken soll kein Kontextmenü und keine Textauswahl auslösen
    meldung.style.webkitUserSelect = 'none';
    meldung.style.userSelect = 'none';
    meldung.style.webkitTouchCallout = 'none';
    meldung.addEventListener('contextmenu', function (ev) {
      if (meldung._rueckfall) ev.preventDefault();
    });

    var timer = null;
    function stopp() { clearTimeout(timer); timer = null; }
    meldung.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.team-rueckfall')) return;
      stopp();
      timer = setTimeout(function () { bereichZeigen(meldung, ziel); }, DRUECKEN_MS);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (art) {
      meldung.addEventListener(art, stopp);
    });
  }

  function bereichZeigen(meldung, ziel) {
    var angebot = meldung._rueckfall;
    // Nur, solange noch genau diese Fehlermeldung steht — nicht nach einem
    // neuen Versuch oder wenn der Bogen inzwischen geleert wurde.
    if (!angebot || !meldung.classList.contains('fehler')
        || meldung.textContent.indexOf(angebot.text) !== 0) return;
    if (meldung.querySelector('.team-rueckfall')) return;

    var bereich = document.createElement('div');
    bereich.className = 'team-rueckfall';
    bereich.style.cssText = 'margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(179,38,30,.3);'
      + 'color:#0A0A0A';
    var titel = document.createElement('strong');
    titel.textContent = 'Nur fürs Team: Bogen als PDF sichern';
    var hinweis = document.createElement('div');
    hinweis.style.cssText = 'font-size:.85rem;margin:.35rem 0 .8rem;line-height:1.5';
    hinweis.textContent = 'Das PDF öffnet sich in einem neuen Fenster. Bitte drucken oder an '
      + 'fragebogen@feminity-oberkassel.com weiterleiten — nicht auf dem Tablet ablegen. '
      + 'Danach „Formular leeren“.';
    var knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'btn-klein';
    knopf.textContent = 'PDF erzeugen';
    var leeren = document.createElement('button');
    leeren.type = 'button';
    leeren.className = 'btn-klein';
    leeren.style.marginLeft = '.5rem';
    leeren.textContent = 'Formular leeren';
    var status = document.createElement('div');
    status.style.cssText = 'font-size:.85rem;margin-top:.7rem';

    knopf.addEventListener('click', function () {
      knopf.disabled = true;
      knopf.textContent = 'Wird erzeugt …';
      var nutzlast = {};
      for (var k in angebot.daten) nutzlast[k] = angebot.daten[k];
      nutzlast.nurPdf = true;
      fetch(ziel || '/api/fragebogen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nutzlast),
      })
        .then(function (a) {
          if (a.ok && /application\/pdf/.test(a.headers.get('Content-Type') || '')) return a.blob();
          throw new Error('server');
        })
        .then(function (blob) {
          // Zweiter Tipp öffnet das PDF — ein direkter Tipp, den Safari
          // nicht als ungefragtes Fenster blockiert.
          var link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.target = '_blank';
          link.rel = 'noopener';
          link.className = 'btn-klein';
          link.textContent = 'PDF öffnen';
          // Sieht aus wie die Knöpfe daneben — deren Gestaltung gilt nur für <button>
          link.style.cssText = 'display:inline-block;text-decoration:none;color:#0A0A0A;font-weight:600;'
            + 'border:2px solid #C9A74A;background:#C9A74A;border-radius:50px;padding:.6rem 1.25rem;font-size:.85rem';
          knopf.replaceWith(link);
          angebot.pdfUrl = link.href;
        })
        .catch(function (e) {
          knopf.disabled = false;
          knopf.textContent = 'Erneut versuchen';
          status.textContent = e && e.message === 'server'
            ? 'Das PDF konnte nicht erzeugt werden. Bitte den Papierbogen verwenden.'
            : 'Keine Verbindung zum Server. Bitte den Papierbogen verwenden.';
        });
    });

    // Neu laden statt Felder einzeln leeren: Die Angaben liegen nur im
    // Arbeitsspeicher der Seite, mit dem Neuladen sind sie vollständig weg.
    leeren.addEventListener('click', function () {
      if (angebot.pdfUrl) URL.revokeObjectURL(angebot.pdfUrl);
      location.replace(location.pathname);
    });

    bereich.appendChild(titel);
    bereich.appendChild(hinweis);
    bereich.appendChild(knopf);
    bereich.appendChild(leeren);
    bereich.appendChild(status);
    meldung.appendChild(bereich);
  }

  global.ABSENDEN = {
    absenden: absenden, rueckfallAnbieten: rueckfallAnbieten, FRIST_MS: FRIST_MS,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
