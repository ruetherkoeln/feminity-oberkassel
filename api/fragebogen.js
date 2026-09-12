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

const MEDIEN = {
  foto: 'Fotoaufnahmen',
  video: 'Videoaufnahmen',
  ton: 'Tonaufnahmen (z. B. Stimme in einem Video)',
};

const KANAELE = {
  instagram: 'Instagram und Facebook',
  website: 'Website feminity-oberkassel.de',
  google: 'Google-Unternehmensprofil',
  print: 'Gedrucktes Material und Aushang im Salon',
  anzeigen: 'Bezahlte Werbeanzeigen',
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
function pdfBauen(bogen, d, unterschrift, jetzt) {
  const pdf = new Pdf();

  pdf.text('Feminity Oberkassel · Groom&Glow UG (haftungsbeschränkt)', { groesse: 8.5, abstand: 2 });
  pdf.text('Hansaallee 1a · 40549 Düsseldorf', { groesse: 8.5, abstand: 10 });
  pdf.ueberschrift(bogen.titel, 16);
  pdf.linie();

  pdf.ueberschrift('Angaben zur Person', 11.5);
  pdf.feld('Name', `${d.vorname} ${d.nachname}`);
  if (d.geburtsdatum) pdf.feld('Geburtsdatum', datumAusFormular(d.geburtsdatum));
  if (d.email) pdf.feld('E-Mail', d.email);
  if (d.telefon) pdf.feld('Telefon', d.telefon);
  pdf.luecke(6);

  pdf.ueberschrift('Art der Aufnahmen', 11.5);
  const medien = (d.medien || []).filter((m) => MEDIEN[m]);
  pdf.text(medien.length ? medien.map((m) => `[x]  ${MEDIEN[m]}`).join('\n') : '[  ] keine Angabe', { groesse: 10 });
  for (const schluessel of Object.keys(MEDIEN)) {
    if (!medien.includes(schluessel)) pdf.text(`[  ]  ${MEDIEN[schluessel]}`, { groesse: 10, abstand: 0 });
  }
  pdf.luecke(10);

  pdf.ueberschrift('Verwendung', 11.5);
  const kanaele = (d.kanaele || []).filter((k) => KANAELE[k]);
  for (const schluessel of Object.keys(KANAELE)) {
    pdf.text(`${kanaele.includes(schluessel) ? '[x]' : '[  ]'}  ${KANAELE[schluessel]}`, { groesse: 10, abstand: 0 });
  }
  pdf.luecke(10);

  pdf.ueberschrift('Umfang', 11.5);
  pdf.feld('Namensnennung', d.namensnennung === 'ja'
    ? 'Mein Vorname darf genannt werden'
    : 'Mein Name darf nicht genannt werden');
  pdf.feld('Erkennbarkeit', d.erkennbar === 'nein'
    ? 'Nur Aufnahmen, auf denen ich nicht erkennbar bin'
    : 'Aufnahmen, auf denen ich erkennbar bin, sind erlaubt');
  pdf.luecke(8);

  pdf.ueberschrift('Erklärung', 11.5);
  for (const absatz of bogen.rechtstext) pdf.text(absatz, { groesse: 9.5, abstand: 7 });
  pdf.luecke(8);

  // Der Unterschriftsblock darf nicht zwischen Ueberschrift und Strich
  // auseinanderfallen — lieber eine neue Seite beginnen.
  pdf.platz(d.minderjaehrig ? 230 : 190);
  pdf.linie();
  pdf.ueberschrift('Unterschrift', 11.5);
  if (d.minderjaehrig) {
    pdf.text(
      'Die einwilligende Person ist minderjährig. Es unterschreibt die gesetzliche Vertretung:',
      { groesse: 9.5, abstand: 4 }
    );
    pdf.feld('Gesetzliche Vertretung', d.vertreter || '—');
  }
  pdf.bild(unterschrift, 230, 85);
  pdf.text(`${d.unterschriftsort || 'Düsseldorf'}, ${deutschesDatum(jetzt)}`, { groesse: 9.5, abstand: 2 });
  pdf.text(
    d.minderjaehrig ? `${d.vertreter || ''} für ${d.vorname} ${d.nachname}` : `${d.vorname} ${d.nachname}`,
    { groesse: 9.5, abstand: 12 }
  );

  pdf.linie(0.4, 0.85);
  pdf.text(
    `Digital erfasst im Salon am ${deutschesDatum(jetzt)} um ${deutscheZeit(jetzt)} Uhr. ` +
    'Die Unterschrift wurde auf einem Tablet mit dem Finger gezeichnet.',
    { groesse: 8, abstand: 0 }
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
