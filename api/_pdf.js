// Minimaler PDF-Erzeuger ohne Abhängigkeiten.
//
// Warum selbst geschrieben statt pdf-lib: Die Website ist eine reine
// Sammlung statischer HTML-Dateien ohne package.json. Eine Abhängigkeit
// würde einen Installations- und Build-Schritt erzwingen und damit den
// Live-Betrieb des Salons an einen Build-Prozess koppeln. Was hier
// gebraucht wird — Fließtext, ein paar Überschriften und ein
// eingebettetes Unterschriftsbild — ist mit Bordmitteln überschaubar.
//
// Schriften: die 14 Standard-Schriften eines PDF-Betrachters müssen nicht
// eingebettet werden. Mit WinAnsiEncoding sind deutsche Umlaute und ß
// abgedeckt, deshalb wird der Text nach cp1252 kodiert.

const SEITE = { breite: 595.28, hoehe: 841.89 }; // A4 in Punkt
const RAND = 56;
const TEXTBREITE = SEITE.breite - 2 * RAND;

// ── Text-Kodierung ──────────────────────────────────────────────────────────
// cp1252 deckt Latin-1 plus die typografischen Zeichen im Bereich 0x80–0x9F ab.
const CP1252_SONDER = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84,
  '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88,
  '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
  'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93,
  '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

function nachCp1252(text) {
  const bytes = [];
  for (const zeichen of String(text)) {
    const code = zeichen.codePointAt(0);
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) {
      bytes.push(code);
    } else if (CP1252_SONDER[zeichen] !== undefined) {
      bytes.push(CP1252_SONDER[zeichen]);
    } else {
      bytes.push(0x3f); // "?" — alles, was cp1252 nicht kennt
    }
  }
  return Buffer.from(bytes);
}

// Klammern und Backslash sind in PDF-Zeichenketten Steuerzeichen.
function maskieren(buf) {
  const raus = [];
  for (const b of buf) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) raus.push(0x5c);
    raus.push(b);
  }
  return Buffer.from(raus);
}

// ── Textbreite ──────────────────────────────────────────────────────────────
// Breitentabelle für Helvetica (Einheit: 1/1000 em), damit der Umbruch nicht
// raten muss. Nicht erfasste Zeichen bekommen einen mittleren Wert.
const BREITEN = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667,
  "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333,
  '.': 278, '/': 278, '0': 556, '1': 556, '2': 556, '3': 556, '4': 556,
  '5': 556, '6': 556, '7': 556, '8': 556, '9': 556, ':': 278, ';': 278,
  '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015, 'A': 667, 'B': 667,
  'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722, 'I': 278,
  'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667,
  'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944,
  'X': 667, 'Y': 667, 'Z': 611, '[': 278, '\\': 278, ']': 278, '^': 469,
  '_': 556, '`': 333, 'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556,
  'f': 278, 'g': 556, 'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222,
  'm': 833, 'n': 556, 'o': 556, 'p': 556, 'q': 556, 'r': 333, 's': 500,
  't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500, 'y': 500, 'z': 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
  'ä': 556, 'ö': 556, 'ü': 556, 'Ä': 667, 'Ö': 778, 'Ü': 722, 'ß': 556,
  '§': 556, '€': 556, '–': 556, '—': 1000, '„': 333, '“': 333, '”': 333,
  '‚': 222, '‘': 222, '’': 222, '•': 350, '…': 1000, '°': 400,
};

function textbreite(text, groesse, fett) {
  let tausendstel = 0;
  for (const z of String(text)) tausendstel += BREITEN[z] !== undefined ? BREITEN[z] : 556;
  // Helvetica-Bold ist im Mittel gut 5 % breiter als die Grundschrift.
  return (tausendstel / 1000) * groesse * (fett ? 1.05 : 1);
}

function umbrechen(text, groesse, fett, maxBreite) {
  const zeilen = [];
  for (const absatz of String(text).split('\n')) {
    if (!absatz.trim()) { zeilen.push(''); continue; }
    let zeile = '';
    for (const wort of absatz.split(/\s+/)) {
      const versuch = zeile ? zeile + ' ' + wort : wort;
      if (textbreite(versuch, groesse, fett) > maxBreite && zeile) {
        zeilen.push(zeile);
        zeile = wort;
      } else {
        zeile = versuch;
      }
    }
    if (zeile) zeilen.push(zeile);
  }
  return zeilen;
}

// ── JPEG ────────────────────────────────────────────────────────────────────
// Ein Baseline-JPEG lässt sich unverändert als /DCTDecode einbetten — kein
// Dekodieren nötig. Gebraucht werden nur Maße und Kanalzahl aus dem
// SOF-Segment. Genau deshalb liefert das Unterschriftsfeld JPEG und nicht PNG:
// PNG müsste erst entpackt und neu komprimiert werden.
function jpegDaten(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error('Kein JPEG');
  }
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const laenge = buf.readUInt16BE(i + 2);
    // SOF0/1/2/9/10 — Startsegmente mit den Bildmaßen
    if ([0xc0, 0xc1, 0xc2, 0xc9, 0xca].includes(marker)) {
      return {
        hoehe: buf.readUInt16BE(i + 5),
        breite: buf.readUInt16BE(i + 7),
        kanaele: buf[i + 9],
      };
    }
    i += 2 + laenge;
  }
  throw new Error('JPEG ohne Bildmaße');
}

// ── Dokument ────────────────────────────────────────────────────────────────
class Pdf {
  constructor() {
    this.seiten = [];
    this.bilder = [];
    this.neueSeite();
  }

  neueSeite() {
    this.aktuell = { teile: [], bilder: [] };
    this.seiten.push(this.aktuell);
    this.y = SEITE.hoehe - RAND;
  }

  // Sorgt dafür, dass noch `noetig` Punkt Platz sind, sonst neue Seite.
  platz(noetig) {
    if (this.y - noetig < RAND) this.neueSeite();
  }

  text(inhalt, { groesse = 10, fett = false, abstand = 4, breite = TEXTBREITE, einzug = 0 } = {}) {
    const zeilenhoehe = groesse * 1.45;
    for (const zeile of umbrechen(inhalt, groesse, fett, breite)) {
      this.platz(zeilenhoehe);
      if (zeile) {
        const roh = maskieren(nachCp1252(zeile)).toString('latin1');
        this.aktuell.teile.push(
          `BT /${fett ? 'F2' : 'F1'} ${groesse} Tf 1 0 0 1 ${(RAND + einzug).toFixed(2)} ${this.y.toFixed(2)} Tm (${roh}) Tj ET`
        );
      }
      this.y -= zeilenhoehe;
    }
    this.y -= abstand;
  }

  ueberschrift(inhalt, groesse = 15) {
    this.platz(groesse * 2.2);
    this.text(inhalt, { groesse, fett: true, abstand: 8 });
  }

  linie(staerke = 0.6, grau = 0.75) {
    this.platz(10);
    this.aktuell.teile.push(
      `q ${grau} G ${staerke} w ${RAND} ${this.y.toFixed(2)} m ${(SEITE.breite - RAND).toFixed(2)} ${this.y.toFixed(2)} l S Q`
    );
    this.y -= 12;
  }

  luecke(hoehe = 10) {
    this.y -= hoehe;
  }

  // Beschriftung links, Wert rechts — für die Angaben aus dem Formular.
  feld(bezeichnung, wert) {
    const spalte = 150;
    const zeilen = umbrechen(wert || '—', 10, false, TEXTBREITE - spalte);
    this.platz(zeilen.length * 14.5 + 4);
    const start = this.y;
    const bez = maskieren(nachCp1252(bezeichnung)).toString('latin1');
    this.aktuell.teile.push(
      `BT /F2 9.5 Tf 1 0 0 1 ${RAND} ${start.toFixed(2)} Tm (${bez}) Tj ET`
    );
    let y = start;
    for (const zeile of zeilen) {
      const roh = maskieren(nachCp1252(zeile)).toString('latin1');
      this.aktuell.teile.push(
        `BT /F1 10 Tf 1 0 0 1 ${(RAND + spalte).toFixed(2)} ${y.toFixed(2)} Tm (${roh}) Tj ET`
      );
      y -= 14.5;
    }
    this.y = y - 3;
  }

  // jpeg: Buffer. Höhe wird aus dem Seitenverhältnis berechnet.
  bild(jpeg, maxBreite = 220, maxHoehe = 90) {
    const info = jpegDaten(jpeg);
    let b = maxBreite;
    let h = (info.hoehe / info.breite) * b;
    if (h > maxHoehe) { h = maxHoehe; b = (info.breite / info.hoehe) * h; }
    this.platz(h + 6);
    const name = `Img${this.bilder.length}`;
    this.bilder.push({ name, jpeg, info });
    this.aktuell.bilder.push(name);
    this.aktuell.teile.push(
      `q ${b.toFixed(2)} 0 0 ${h.toFixed(2)} ${RAND} ${(this.y - h).toFixed(2)} cm /${name} Do Q`
    );
    this.y -= h + 6;
    return { breite: b, hoehe: h };
  }

  bauen() {
    const objekte = [];   // 1-basiert, Index 0 bleibt leer
    const push = (inhalt) => { objekte.push(inhalt); return objekte.length; };

    // Schriften
    const f1 = push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
    const f2 = push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));

    // Bilder
    const bildNr = {};
    for (const bild of this.bilder) {
      const kopf = Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${bild.info.breite} /Height ${bild.info.hoehe} ` +
        `/ColorSpace ${bild.info.kanaele === 1 ? '/DeviceGray' : '/DeviceRGB'} /BitsPerComponent 8 ` +
        `/Filter /DCTDecode /Length ${bild.jpeg.length} >>\nstream\n`
      );
      bildNr[bild.name] = push(Buffer.concat([kopf, bild.jpeg, Buffer.from('\nendstream')]));
    }

    // Seiten-Baum: Nummer vorab reservieren, weil die Seiten ihn brauchen
    const seitenBaumNr = objekte.length + 1 + this.seiten.length * 2;

    const seitenNummern = [];
    for (const seite of this.seiten) {
      const strom = Buffer.from(seite.teile.join('\n'), 'latin1');
      const inhaltNr = push(Buffer.concat([
        Buffer.from(`<< /Length ${strom.length} >>\nstream\n`), strom, Buffer.from('\nendstream'),
      ]));
      const xobj = seite.bilder.length
        ? ` /XObject << ${seite.bilder.map((n) => `/${n} ${bildNr[n]} 0 R`).join(' ')} >>`
        : '';
      seitenNummern.push(push(Buffer.from(
        `<< /Type /Page /Parent ${seitenBaumNr} 0 R /MediaBox [0 0 ${SEITE.breite} ${SEITE.hoehe}] ` +
        `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xobj} >> /Contents ${inhaltNr} 0 R >>`
      )));
    }

    const baum = push(Buffer.from(
      `<< /Type /Pages /Kids [${seitenNummern.map((n) => `${n} 0 R`).join(' ')}] /Count ${seitenNummern.length} >>`
    ));
    if (baum !== seitenBaumNr) throw new Error('Objektnummern verrutscht');
    const katalog = push(Buffer.from(`<< /Type /Catalog /Pages ${baum} 0 R >>`));

    // Zusammensetzen mit Querverweistabelle
    const teile = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    let laenge = teile[0].length;
    const versatz = [0];
    objekte.forEach((inhalt, i) => {
      versatz.push(laenge);
      const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), inhalt, Buffer.from('\nendobj\n')]);
      teile.push(obj);
      laenge += obj.length;
    });

    const xrefStart = laenge;
    let xref = `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objekte.length; i++) {
      xref += String(versatz[i]).padStart(10, '0') + ' 00000 n \n';
    }
    xref += `trailer\n<< /Size ${objekte.length + 1} /Root ${katalog} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    teile.push(Buffer.from(xref, 'latin1'));

    return Buffer.concat(teile);
  }
}

module.exports = { Pdf, SEITE, RAND, TEXTBREITE };
