// POST /api/fragebogen
//
// Nimmt einen im Salon ausgefüllten Bogen entgegen, erzeugt daraus ein PDF
// mit der gezeichneten Unterschrift und schickt es an das Salon-Postfach.
// Nichts wird gespeichert: Die Daten leben nur für die Dauer dieser Anfrage.

const { Pdf } = require('./_pdf.js');
const { senden } = require('./_smtp.js');

const MAX_KOERPER = 3 * 1024 * 1024;   // 3 MB — die Unterschrift wiegt wenige KB
const MAX_FELD = 400;                   // Zeichen pro Textfeld

// ── Bogen-Definitionen ──────────────────────────────────────────────────────
// Weitere Bögen werden hier ergänzt; Formular und PDF bleiben dieselbe Maschine.
const BOEGEN = {
  'einwilligung-bild-ton': {
    titel: 'Einwilligung in Bild- und Tonaufnahmen',
    dateiname: 'Einwilligung-Bild-Ton',
    pflicht: ['vorname', 'nachname'],
    // Rechtlicher Text, der mit ins PDF wandert — der unterschriebene Bogen
    // muss aus sich heraus belegen, worin eingewilligt wurde.
    rechtstext: [
      'Ich willige ein, dass die oben bezeichneten Aufnahmen von mir angefertigt und für die ' +
        'angekreuzten Zwecke verwendet werden dürfen. Die Einwilligung erfolgt freiwillig; ' +
        'aus einer Verweigerung entstehen mir keine Nachteile, insbesondere bleibt mein ' +
        'Behandlungstermin davon unberührt.',
      'Die Einwilligung ist jederzeit mit Wirkung für die Zukunft widerrufbar, formlos und ohne ' +
        'Angabe von Gründen — per E-Mail an admin@feminity-oberkassel.de. Bereits erfolgte ' +
        'Veröffentlichungen werden daraufhin unverzüglich entfernt, soweit dies möglich und ' +
        'zumutbar ist. Bei Aufnahmen, die bereits von Dritten geteilt wurden, kann eine ' +
        'vollständige Entfernung aus dem Internet nicht zugesichert werden.',
      'Eine Vergütung für die Aufnahmen und ihre Verwendung wird nicht gewährt.',
      'Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe a der Datenschutz-Grundverordnung in ' +
        'Verbindung mit § 22 Kunsturhebergesetz. Verantwortlich ist die Groom&Glow UG ' +
        '(haftungsbeschränkt), Hansaallee 1a, 40549 Düsseldorf.',
    ],
  },
};

// Diese beiden Tabellen steuern Formular und PDF gleichermaßen: Was hier
// steht, erscheint im Bogen als Ankreuzfeld und im PDF als [x] bzw. [ ].
const MEDIEN = {
  foto: 'Fotos',
  video: 'Videos (Bild und Ton)',
};

const KANAELE = {
  social: 'Social Media (z. B. Instagram und Facebook)',
  website: 'Unsere Website und Salonprofile (z. B. Treatwell)',
  print: 'Print (z. B. Aushang im Salon, Flyer)',
};

// ── Hilfen ──────────────────────────────────────────────────────────────────
const txt = (wert) => String(wert === undefined || wert === null ? '' : wert).trim().slice(0, MAX_FELD);

function koerperLesen(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((fertig, fehler) => {
    let roh = '';
    req.on('data', (stueck) => {
      roh += stueck;
      if (roh.length > MAX_KOERPER) {
        fehler(new Error('Anfrage zu groß'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { fertig(roh ? JSON.parse(roh) : {}); } catch { fehler(new Error('Ungültiges JSON')); }
    });
    req.on('error', fehler);
  });
}

function unterschriftLesen(datenUrl) {
  const treffer = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(datenUrl || ''));
  if (!treffer) return null;
  const buf = Buffer.from(treffer[1], 'base64');
  // Eine leere Fläche ergibt ein winziges JPEG — das wäre eine fehlende Unterschrift.
  if (buf.length < 900) return null;
  return buf;
}

const deutschesDatum = (d) =>
  d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });

// <input type="date"> liefert immer JJJJ-MM-TT. Im PDF soll TT.MM.JJJJ stehen.
function datumAusFormular(wert) {
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(wert || ''));
  return t ? `${t[3]}.${t[2]}.${t[1]}` : String(wert || '');
}

const deutscheZeit = (d) =>
  d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

// ── PDF ─────────────────────────────────────────────────────────────────────
// Zielformat: eine A4-Seite. Der Bogen wird im Salon abgeheftet und soll
// nicht aus zwei losen Blättern bestehen, von denen eines die Unterschrift
// trägt. Deshalb kompakte Grade, enge Abstände und die beiden Ankreuzblöcke
// nebeneinander statt untereinander.
const SPALTE_BREITE = 240;
const SPALTE_RECHTS = 267;

function pdfBauen(bogen, d, unterschrift, jetzt) {
  const pdf = new Pdf();
  const H = 10.5;  // Grad der Zwischenüberschriften
  const feldStil = { spalte: 100, groesse: 9, zeilenhoehe: 11.5 };

  pdf.text('Feminity Oberkassel · Groom&Glow UG (haftungsbeschränkt) · Hansaallee 1a · 40549 Düsseldorf',
    { groesse: 8, abstand: 6 });
  pdf.ueberschrift(bogen.titel, 15, 5);
  pdf.linie(0.6, 0.75, 9);

  pdf.ueberschrift('Angaben zur Person', H, 3);
  pdf.feld('Name', `${d.vorname} ${d.nachname}`, feldStil);
  if (d.geburtsdatum) pdf.feld('Geburtsdatum', datumAusFormular(d.geburtsdatum), feldStil);
  if (d.email) pdf.feld('E-Mail', d.email, feldStil);
  if (d.telefon) pdf.feld('Telefon', d.telefon, feldStil);
  pdf.luecke(6);

  // Zwei Spalten: links die Aufnahmearten, rechts die Verwendung.
  // y wird gemerkt, die rechte Spalte beginnt wieder oben, und danach geht
  // es unterhalb der längeren von beiden weiter.
  const medien = (d.medien || []).filter((m) => MEDIEN[m]);
  const kanaele = (d.kanaele || []).filter((k) => KANAELE[k]);
  const oben = pdf.y;

  pdf.ueberschrift('Art der Aufnahmen', H, 3);
  for (const schluessel of Object.keys(MEDIEN)) {
    pdf.text(`${medien.includes(schluessel) ? '[x]' : '[  ]'}  ${MEDIEN[schluessel]}`,
      { groesse: 9, abstand: 0, breite: SPALTE_BREITE });
  }
  const linksUnten = pdf.y;

  // Zurück nach oben für die rechte Spalte. Die Überschrift wird hier als
  // fetter Text gesetzt statt über ueberschrift(), weil sie den Einzug der
  // Spalte braucht.
  pdf.y = oben;
  pdf.text('Verwendung', { groesse: H, fett: true, abstand: 3, einzug: SPALTE_RECHTS, breite: SPALTE_BREITE });
  for (const schluessel of Object.keys(KANAELE)) {
    pdf.text(`${kanaele.includes(schluessel) ? '[x]' : '[  ]'}  ${KANAELE[schluessel]}`,
      { groesse: 9, abstand: 0, breite: SPALTE_BREITE, einzug: SPALTE_RECHTS });
  }

  pdf.y = Math.min(linksUnten, pdf.y) - 10;

  pdf.ueberschrift('Umfang', H, 3);
  pdf.feld('Namensnennung', d.namensnennung === 'ja'
    ? 'Mein Vorname darf genannt werden'
    : 'Mein Name darf nicht genannt werden', feldStil);
  pdf.feld('Erkennbarkeit', d.erkennbar === 'nein'
    ? 'Nur Aufnahmen, auf denen ich nicht erkennbar bin'
    : 'Aufnahmen, auf denen ich erkennbar bin, sind erlaubt', feldStil);
  pdf.luecke(6);

  pdf.ueberschrift('Erklärung', H, 3);
  for (const absatz of bogen.rechtstext) pdf.text(absatz, { groesse: 8.5, abstand: 5 });
  pdf.luecke(4);

  pdf.linie(0.6, 0.75, 9);
  pdf.ueberschrift('Unterschrift', H, 3);
  if (d.minderjaehrig) {
    pdf.text('Die einwilligende Person ist minderjährig. Es unterschreibt die gesetzliche Vertretung:',
      { groesse: 8.5, abstand: 2 });
    // Ohne Beschriftung — der Satz darüber sagt bereits, wer hier steht.
    // Als Feld gesetzt stieße "Gesetzliche Vertretung" an den Namen.
    pdf.text(d.vertreter || '—', { groesse: 9.5, fett: true, abstand: 4 });
  }
  pdf.bild(unterschrift, 200, 62);
  pdf.text(`${d.unterschriftsort || 'Düsseldorf'}, ${deutschesDatum(jetzt)}`, { groesse: 9, abstand: 1 });
  pdf.text(
    d.minderjaehrig ? `${d.vertreter || ''} für ${d.vorname} ${d.nachname}` : `${d.vorname} ${d.nachname}`,
    { groesse: 9, abstand: 8 }
  );

  pdf.linie(0.4, 0.85, 8);
  pdf.text(
    `Digital erfasst im Salon am ${deutschesDatum(jetzt)} um ${deutscheZeit(jetzt)} Uhr. ` +
    'Die Unterschrift wurde auf einem Tablet mit dem Finger gezeichnet.',
    { groesse: 7.5, abstand: 0 }
  );

  return pdf.bauen();
}

// ── Handler ─────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, fehler: 'Nur POST' });
  }

  let d;
  try {
    d = await koerperLesen(req);
  } catch (e) {
    return res.status(400).json({ ok: false, fehler: e.message });
  }

  // Honigtopf: Bots füllen versteckte Felder aus. Still mit Erfolg antworten.
  if (txt(d.webseite)) return res.status(200).json({ ok: true });

  const bogen = BOEGEN[txt(d.bogen)];
  if (!bogen) return res.status(400).json({ ok: false, fehler: 'Unbekannter Bogen' });

  const felder = {};
  for (const name of ['vorname', 'nachname', 'geburtsdatum', 'email', 'telefon', 'vertreter', 'unterschriftsort']) {
    felder[name] = txt(d[name]);
  }
  felder.medien = Array.isArray(d.medien) ? d.medien.map(txt) : [];
  felder.kanaele = Array.isArray(d.kanaele) ? d.kanaele.map(txt) : [];
  felder.namensnennung = txt(d.namensnennung);
  felder.erkennbar = txt(d.erkennbar);
  felder.minderjaehrig = d.minderjaehrig === true || txt(d.minderjaehrig) === 'ja';

  for (const name of bogen.pflicht) {
    if (!felder[name]) return res.status(400).json({ ok: false, fehler: 'pflicht' });
  }
  if (felder.minderjaehrig && !felder.vertreter) {
    return res.status(400).json({ ok: false, fehler: 'vertreter' });
  }
  if (d.einwilligung !== true) return res.status(400).json({ ok: false, fehler: 'einwilligung' });

  const unterschrift = unterschriftLesen(d.signatur);
  if (!unterschrift) return res.status(400).json({ ok: false, fehler: 'signatur' });

  const zugang = {
    host: process.env.SMTP_HOST || 'smtp.ionos.de',
    port: Number(process.env.SMTP_PORT || 465),
    benutzer: process.env.SMTP_BENUTZER,
    passwort: process.env.SMTP_PASSWORT,
  };
  const an = process.env.MAIL_AN || 'fragebogen@feminity-oberkassel.com';
  const von = process.env.MAIL_VON || zugang.benutzer;
  if (!zugang.benutzer || !zugang.passwort) {
    console.error('Fragebogen: SMTP-Zugangsdaten fehlen');
    return res.status(500).json({ ok: false, fehler: 'konfiguration' });
  }

  const jetzt = new Date();
  let pdf;
  try {
    pdf = pdfBauen(bogen, felder, unterschrift, jetzt);
  } catch (e) {
    console.error('Fragebogen: PDF fehlgeschlagen —', e.message);
    return res.status(500).json({ ok: false, fehler: 'pdf' });
  }

  const name = `${felder.nachname}-${felder.vorname}`.replace(/[^A-Za-zÀ-ÿ0-9-]/g, '_');
  const datei = `${bogen.dateiname}_${name}_${jetzt.toISOString().slice(0, 10)}.pdf`;

  try {
    await senden(zugang, {
      von,
      vonName: 'Feminity Oberkassel — Bögen',
      an,
      betreff: `${bogen.titel}: ${felder.vorname} ${felder.nachname}`,
      text:
        `${bogen.titel}\n\n` +
        `Name:        ${felder.vorname} ${felder.nachname}\n` +
        (felder.geburtsdatum ? `Geburtsdatum: ${datumAusFormular(felder.geburtsdatum)}\n` : '') +
        (felder.email ? `E-Mail:      ${felder.email}\n` : '') +
        (felder.telefon ? `Telefon:     ${felder.telefon}\n` : '') +
        `Erfasst:     ${deutschesDatum(jetzt)} um ${deutscheZeit(jetzt)} Uhr\n\n` +
        'Der unterschriebene Bogen liegt als PDF im Anhang.',
      anhang: { name: datei, typ: 'application/pdf', daten: pdf },
    });
  } catch (e) {
    // Ohne Details: die Eingaben der Gäste gehören nicht ins Log
    console.error('Fragebogen: Versand fehlgeschlagen —', e.message);
    return res.status(502).json({ ok: false, fehler: 'versand' });
  }

  // Kopie an die einwilligende Person, damit sie ihre Erklärung belegen kann.
  // Scheitert sie, ist der Bogen trotzdem angekommen — kein Fehler nach außen.
  if (felder.email && /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(felder.email)) {
    try {
      await senden(zugang, {
        von,
        vonName: 'Feminity Oberkassel',
        an: felder.email,
        betreff: 'Ihre Einwilligung bei Feminity Oberkassel',
        text:
          `Guten Tag ${felder.vorname} ${felder.nachname},\n\n` +
          'anbei Ihre heute im Salon erteilte Einwilligung als PDF — zum Nachlesen und Aufbewahren.\n\n' +
          'Sie können diese Einwilligung jederzeit widerrufen, formlos und ohne Angabe von Gründen, ' +
          'per E-Mail an admin@feminity-oberkassel.de.\n\n' +
          'Herzliche Grüße\nIhr Team von Feminity Oberkassel\n' +
          'Hansaallee 1a · 40549 Düsseldorf',
        anhang: { name: datei, typ: 'application/pdf', daten: pdf },
      });
    } catch (e) {
      console.error('Fragebogen: Kopie an die Person fehlgeschlagen —', e.message);
    }
  }

  return res.status(200).json({ ok: true });
};
