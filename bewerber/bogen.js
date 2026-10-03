// Gemeinsame Bausteine der Bewerber-Bögen: Auswahlknöpfe aus dem Katalog,
// Einsammeln der Eingaben, Pflichtprüfung, Unterschriftsfeld und die Anzeige
// beim Absenden. Die Salon-Bögen unter /im-salon tragen dieselbe Logik noch
// einzeln in jeder Seite; hier sind es drei Seiten mit vielen Feldern, da
// lohnt die gemeinsame Datei.
//
// Braucht vorher: /bewerber/katalog.js (BEWERBER) und /im-salon/senden.js (ABSENDEN).
//
// Konventionen im HTML:
//   name="x"            Feld landet als daten.x in der Übertragung
//   name="texte.y"      … als daten.texte.y (Objekt)
//   <div class="pillen" data-liste="POSITIONEN" data-name="positionen" data-mehrfach>
//                       Knöpfe aus dem Katalog; mit data-mehrfach als Liste
//   <div class="gruppe" data-pflicht>  mindestens eine Auswahl nötig
//   data-wenn="name=wert"  Element nur sichtbar, wenn diese Auswahl getroffen ist

(function (global) {
  'use strict';

  var K = global.BEWERBER;

  // ── Aufbau ─────────────────────────────────────────────────────────────
  function pillenFuellen(box, liste, name, mehrfach) {
    liste.forEach(function (eintrag) {
      var l = document.createElement('label');
      var input = document.createElement('input');
      input.type = mehrfach ? 'checkbox' : 'radio';
      input.name = name;
      input.value = eintrag.id;
      var span = document.createElement('span');
      span.textContent = eintrag.name;
      l.appendChild(input);
      l.appendChild(span);
      box.appendChild(l);
    });
  }

  function aufbauen(wurzel) {
    Array.prototype.forEach.call(wurzel.querySelectorAll('.pillen[data-liste]'), function (box) {
      pillenFuellen(box, K[box.dataset.liste], box.dataset.name, box.hasAttribute('data-mehrfach'));
    });

    // Freitexte eines Abschnitts aus dem Katalog
    Array.prototype.forEach.call(wurzel.querySelectorAll('[data-texte]'), function (box) {
      K.TEXTE[box.dataset.texte].forEach(function (t) {
        var l = document.createElement('label');
        l.className = 'feld';
        var span = document.createElement('span');
        span.textContent = t.frage;
        var feld = document.createElement(t.lang ? 'textarea' : 'input');
        if (!t.lang) feld.type = 'text';
        feld.name = 'texte.' + t.id;
        feld.maxLength = t.lang ? 1500 : 160;
        feld.autocomplete = 'off';
        l.appendChild(span);
        l.appendChild(feld);
        box.appendChild(l);
      });
    });

    wurzel.addEventListener('change', function (ev) {
      sichtbarkeit(wurzel);
      var offen = ev.target.closest('.offen');
      if (offen) offen.classList.remove('offen');
    });
    wurzel.addEventListener('input', function (ev) {
      var offen = ev.target.closest('.offen');
      if (offen) offen.classList.remove('offen');
    });
    sichtbarkeit(wurzel);
  }

  // Zusatzfelder wie "Sonstiges: …" nur zeigen, wenn die Auswahl passt.
  function sichtbarkeit(wurzel) {
    Array.prototype.forEach.call(wurzel.querySelectorAll('[data-wenn]'), function (el) {
      var teile = el.dataset.wenn.split('=');
      el.hidden = !wurzel.querySelector(
        'input[name="' + teile[0] + '"][value="' + teile[1] + '"]:checked');
    });
  }

  // ── Einsammeln ─────────────────────────────────────────────────────────
  function setzen(ziel, pfad, wert) {
    var teile = pfad.split('.');
    if (teile.length === 1) { ziel[pfad] = wert; return; }
    ziel[teile[0]] = ziel[teile[0]] || {};
    ziel[teile[0]][teile[1]] = wert;
  }

  function sammeln(wurzel) {
    var daten = {};
    Array.prototype.forEach.call(wurzel.querySelectorAll('.pillen[data-mehrfach]'), function (box) {
      daten[box.dataset.name] = [];
    });
    Array.prototype.forEach.call(wurzel.querySelectorAll('[name]'), function (el) {
      if (el.closest('[hidden]')) return;   // Ausgeblendetes zählt nicht
      if (el.type === 'radio') {
        if (el.checked) setzen(daten, el.name, el.value);
      } else if (el.type === 'checkbox') {
        if (el.checked && Array.isArray(daten[el.name])) daten[el.name].push(el.value);
      } else {
        var wert = el.value.trim();
        if (wert) setzen(daten, el.name, wert);
      }
    });
    return daten;
  }

  // Markiert Lücken und gibt die erste zurück — oder null, wenn alles da ist.
  function lueckenFinden(wurzel) {
    var erste = null;
    function markieren(el) {
      el.classList.add('offen');
      if (!erste) erste = el;
    }
    Array.prototype.forEach.call(wurzel.querySelectorAll('[required]'), function (el) {
      if (el.closest('[hidden]') || el.type === 'checkbox') return;
      if (!el.value.trim()) markieren(el.closest('.feld') || el);
    });
    Array.prototype.forEach.call(wurzel.querySelectorAll('[data-pflicht]'), function (gruppe) {
      if (gruppe.closest('[hidden]')) return;
      if (!gruppe.querySelector('input:checked')) markieren(gruppe);
    });
    return erste;
  }

  // ── Unterschrift ───────────────────────────────────────────────────────
  // Wie in den Salon-Bögen: weißer Grund, damit das JPEG keine schwarze
  // Fläche bekommt; Zeiger-Ereignisse decken Finger, Stift und Maus ab.
  function unterschrift(canvas, rahmen, leerenKnopf) {
    var ctx = canvas.getContext('2d');
    var gezeichnet = false;
    var zeichnet = false;

    function flaeche() {
      var dpr = window.devicePixelRatio || 1;
      var breite = canvas.clientWidth;
      var hoehe = canvas.clientHeight;
      canvas.width = Math.round(breite * dpr);
      canvas.height = Math.round(hoehe * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, breite, hoehe);
      ctx.strokeStyle = '#0A0A0A';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    function leeren() {
      flaeche();
      gezeichnet = false;
      rahmen.classList.remove('gezeichnet');
    }

    function punkt(ev) {
      var r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    canvas.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      zeichnet = true;
      var p = punkt(ev);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y);
      ctx.stroke();
      gezeichnet = true;
      rahmen.classList.add('gezeichnet');
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!zeichnet) return;
      ev.preventDefault();
      var p = punkt(ev);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (art) {
      canvas.addEventListener(art, function () { zeichnet = false; });
    });
    leerenKnopf.addEventListener('click', leeren);

    var dreh;
    window.addEventListener('resize', function () {
      clearTimeout(dreh);
      dreh = setTimeout(function () { if (!gezeichnet) flaeche(); }, 200);
    });

    flaeche();
    return {
      gezeichnet: function () { return gezeichnet; },
      bild: function () { return canvas.toDataURL('image/jpeg', 0.85); },
      leeren: leeren,
    };
  }

  // ── Absenden ───────────────────────────────────────────────────────────
  var FEHLERTEXT = {
    pflicht: 'Bitte füllen Sie die markierten Pflichtfelder aus.',
    email: 'Bitte prüfen Sie Ihre E-Mail-Adresse.',
    einwilligung: 'Bitte bestätigen Sie die Erklärung.',
    signatur: 'Bitte unterschreiben Sie im dafür vorgesehenen Feld.',
    aufgegeben: 'Der Versand klappt gerade nicht. Bitte lassen Sie die Seite offen und versuchen Sie es '
      + 'in ein paar Minuten noch einmal — oder melden Sie sich kurz bei uns.',
    abgebrochen: 'Abgebrochen. Sie können es erneut versuchen — Ihre Angaben stehen noch.',
    versand: 'Die Angaben konnten nicht versendet werden. Bitte versuchen Sie es gleich noch einmal.',
    konfiguration: 'Der Versand ist noch nicht eingerichtet. Bitte melden Sie sich bei uns.',
    pdf: 'Das Dokument konnte nicht erzeugt werden. Bitte melden Sie sich bei uns.',
  };

  /**
   * o: { meldung, knopf, knopfText, daten, texte (zusätzliche Fehlertexte),
   *      erfolg() }
   */
  function senden(o) {
    var texte = Object.assign({}, FEHLERTEXT, o.texte || {});
    var meldung = o.meldung;
    var knopf = o.knopf;
    var lauf = null;
    var warteStatus = null;

    function zuruecksetzen() {
      knopf.disabled = false;
      knopf.textContent = o.knopfText;
    }

    function wartenZeigen(bisVersuch, rest, versuch) {
      if (!warteStatus) {
        meldung.className = 'meldung warten';
        meldung.textContent = '';
        var text = document.createElement('div');
        var stark = document.createElement('strong');
        stark.textContent = 'Der Versand klemmt gerade. ';
        text.appendChild(stark);
        text.appendChild(document.createTextNode(
          'Wir versuchen es automatisch weiter. Bitte lassen Sie diese Seite offen — '
          + 'Ihre Angaben sind noch da.'));
        meldung.appendChild(text);
        warteStatus = document.createElement('div');
        warteStatus.className = 'warten-status';
        meldung.appendChild(warteStatus);
        var abbrechen = document.createElement('button');
        abbrechen.type = 'button';
        abbrechen.className = 'btn-klein';
        abbrechen.textContent = 'Abbrechen';
        abbrechen.addEventListener('click', function () {
          if (lauf) lauf.abbrechen();
          lauf = null;
          warteStatus = null;
          zuruecksetzen();
          fehler(texte.abgebrochen);
        });
        meldung.appendChild(abbrechen);
        knopf.textContent = 'Wird erneut versucht …';
        meldung.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      warteStatus.textContent = 'Nächster Versuch in ' + bisVersuch + ' Sekunden · '
        + versuch + '. Versuch · noch ' + rest + ' Sekunden';
    }

    function fehler(text) {
      meldung.textContent = text;
      meldung.className = 'meldung fehler';
      meldung.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    meldung.className = 'meldung';
    knopf.disabled = true;
    knopf.textContent = 'Wird gesendet …';

    lauf = global.ABSENDEN.absenden(o.daten, {
      erfolg: function () {
        lauf = null;
        meldung.className = 'meldung';
        zuruecksetzen();
        o.erfolg();
      },
      wartet: wartenZeigen,
      fehler: function (code, fristAbgelaufen) {
        lauf = null;
        warteStatus = null;
        zuruecksetzen();
        fehler(fristAbgelaufen ? texte.aufgegeben : (texte[code] || texte.versand));
      },
    }, '/api/bewerbung');
  }

  // Fehler vor dem Absenden anzeigen und zur Stelle springen.
  function hinweisen(meldung, text, ziel) {
    meldung.textContent = text;
    meldung.className = 'meldung fehler';
    (ziel || meldung).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Erklärungstexte aus dem Katalog als Absätze einsetzen.
  function absaetze(box, liste) {
    liste.forEach(function (absatz) {
      var p = document.createElement('p');
      p.textContent = absatz;
      box.appendChild(p);
    });
  }

  // Nach dem Absenden: Formular weg, Dank her.
  function dankeZeigen() {
    document.getElementById('formular').style.display = 'none';
    document.getElementById('danke').classList.add('an');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  global.BOGEN = {
    aufbauen: aufbauen, sammeln: sammeln, lueckenFinden: lueckenFinden,
    unterschrift: unterschrift, senden: senden, hinweisen: hinweisen,
    absaetze: absaetze, dankeZeigen: dankeZeigen, FEHLERTEXT: FEHLERTEXT,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
