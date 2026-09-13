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
// Jeder Bogen bringt seinen eigenen Rumpf mit. Kopf, Unterschrift und Fusszeile
// sind fuer alle gleich und stehen weiter unten.
const GESUNDHEIT = require('../im-salon/fragen-gesundheit.js');
const MASSAGE = require('../im-salon/fragen-massage.js');

const BOEGEN = {
  'einwilligung-bild-ton': {
    titel: 'Einwilligung in Bild- und Tonaufnahmen',
    dateiname: 'Einwilligung-Bild-Ton',
    pflicht: ['vorname', 'nachname'],
    text: ['vorname', 'nachname', 'geburtsdatum', 'email', 'telefon', 'vertreter',
           'unterschriftsort', 'namensnennung', 'erkennbar'],
    listen: ['medien', 'kanaele'],
    koerper: koerperEinwilligung,
  },

  gesundheitsfragebogen: {
    titel: 'Gesundheitsfragebogen',
    dateiname: 'Gesundheitsfragebogen',
    pflicht: ['vorname', 'nachname', 'geburtsdatum'],
    text: ['vorname', 'nachname', 'geburtsdatum', 'behandlungsdatum', 'email', 'telefon',
           'vertreter', 'unterschriftsort'],
    listen: ['hautzustand'],
    // Antworten und Freitexte kommen als Objekte, nicht als einzelne Felder
    karten: ['antworten', 'details'],
    koerper: koerperGesundheit,
    // Jede Frage braucht ein Ja oder Nein — eine Luecke waere im Zweifel
    // genau die Angabe, auf die es angekommen waere.
    pruefen(f) {
      for (const frage of GESUNDHEIT.FRAGEN) {
        const a = f.antworten[frage.id];
        if (a !== 'ja' && a !== 'nein') return 'unvollstaendig';
      }
      return null;
    },
  },

  massage: {
    titel: 'Vor Ihrer Massage',
    dateiname: 'Massage',
    pflicht: ['vorname', 'nachname', 'geburtsdatum'],
    text: ['vorname', 'nachname', 'geburtsdatum', 'behandlungsdatum', 'email', 'telefon',
           'druck', 'schwerpunkt', 'aussparen', 'vertreter', 'unterschriftsort'],
    listen: ['massagen'],
    karten: ['antworten', 'details'],
    koerper: koerperMassage,
    pruefen(f) {
      for (const frage of MASSAGE.ALLE) {
        const a = f.antworten[frage.id];
        if (a !== 'ja' && a !== 'nein') return 'unvollstaendig';
      }
      return null;
    },
  },

  'persoenliche-daten': {
    titel: 'Persönliche Daten und Erreichbarkeit',
    dateiname: 'Persoenliche-Daten',
    pflicht: ['vorname', 'nachname'],
    text: ['vorname', 'nachname', 'email', 'mobil', 'strasse', 'plz', 'ort',
           'vertreter', 'unterschriftsort'],
    karten: ['antworten'],
    koerper: koerperKontakt,
    pruefen(f) {
      for (const schluessel of Object.keys(KONTAKT)) {
        const a = f.antworten[schluessel];
        if (a !== 'ja' && a !== 'nein') return 'unvollstaendig';
      }
      // Wer per WhatsApp erreicht werden moechte, muss eine Nummer angeben —
      // sonst steht eine Einwilligung ohne Weg, sie einzuloesen.
      if (f.antworten.whatsapp === 'ja' && !f.mobil) return 'mobil';
      // Dasselbe fuer die uebrigen Wege: irgendein Kanal muss da sein.
      const willKontakt = Object.keys(KONTAKT).some((k) => f.antworten[k] === 'ja');
      if (willKontakt && !f.email && !f.mobil) return 'kontaktweg';
      return null;
    },
  },
};

// Steuern Formular und PDF des Einwilligungsbogens gleichermassen.
const MEDIEN = {
  foto: 'Fotos',
  video: 'Videos (Bild und Ton)',
};

const KANAELE = {
  social: 'Social Media (z. B. Instagram und Facebook)',
  website: 'Unsere Website und Salonprofile (z. B. Treatwell)',
  print: 'Print (z. B. Aushang im Salon, Flyer)',
};

// Erklaerung des Massage-Bogens — wandert mit ins PDF.
const MASSAGE_ERKLAERUNG = [
  'Ich habe die vorstehenden Fragen vollständig und wahrheitsgemäß beantwortet und teile ' +
    'Änderungen meines Gesundheitszustands vor der nächsten Behandlung unaufgefordert mit.',
  'Mir ist bekannt, dass es sich um eine Wellness- und Entspannungsmassage handelt. Sie ist ' +
    'keine medizinische Heilbehandlung, dient nicht der Linderung von Krankheiten und ersetzt ' +
    'weder ärztliche Untersuchung noch Physiotherapie.',
  'Ich sage während der Behandlung sofort Bescheid, wenn mir etwas unangenehm ist, der Druck ' +
    'zu stark wird, mir zu warm wird oder Schmerzen auftreten.',
  'Ich willige ausdrücklich ein, dass Feminity Oberkassel die angegebenen Gesundheitsdaten ' +
    'verarbeitet, um die Massage sicher durchführen zu können (Art. 9 Abs. 2 lit. a DSGVO). ' +
    'Die Einwilligung ist freiwillig und jederzeit mit Wirkung für die Zukunft widerrufbar — ' +
    'per E-Mail an admin@feminity-oberkassel.de.',
];

// Kontaktwege des Bogens "Persoenliche Daten" — steuern Formular und PDF.
const KONTAKT = {
  erinnerungen: 'Terminerinnerungen und Neuigkeiten aus dem Salon',
  whatsapp: 'WhatsApp-Broadcast',
  events: 'Infos und Einladungen zu Events',
};

const KONTAKT_ERKLAERUNG = [
  'Ich willige ein, dass Feminity Oberkassel mich auf den oben gewählten Wegen kontaktiert. ' +
    'Die Einwilligung ist freiwillig; ohne sie kann ich den Salon wie gewohnt besuchen.',
  'Ich kann die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, formlos und ohne ' +
    'Angabe von Gründen — per E-Mail an admin@feminity-oberkassel.de oder mit einer kurzen ' +
    'Nachricht im Salon. Dafür entstehen keine anderen als die Übermittlungskosten nach den ' +
    'Basistarifen.',
  'Meine Daten werden nicht an Dritte weitergegeben und nicht für Werbung fremder Unternehmen ' +
    'verwendet.',
  'Beim WhatsApp-Broadcast wird meine Mobilnummer im WhatsApp-Geschäftskonto des Salons ' +
    'gespeichert; die Übermittlung läuft über Meta Platforms Ireland Ltd. Wer das nicht möchte, ' +
    'wählt hier Nein und bleibt über die übrigen Wege erreichbar.',
  'Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe a der Datenschutz-Grundverordnung. ' +
    'Verantwortlich ist die Groom&Glow UG (haftungsbeschränkt), Hansaallee 1a, 40549 Düsseldorf.',
];

// Erklaerung des Einwilligungsbogens — wandert mit ins PDF.
const EINWILLIGUNG_RECHTSTEXT = [
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
];

// Erklaerungen des Gesundheitsbogens — wandern mit ins PDF, damit der
// unterschriebene Bogen aus sich heraus belegt, was erklaert wurde.
const GESUNDHEIT_ERKLAERUNG = [
  'Ich habe die vorstehenden Fragen vollständig und wahrheitsgemäß beantwortet und teile ' +
    'Änderungen meines Gesundheitszustands vor der nächsten Behandlung unaufgefordert mit.',
  'Ich willige ausdrücklich ein, dass Feminity Oberkassel die angegebenen Gesundheitsdaten ' +
    'verarbeitet, um die Behandlung sicher planen und durchführen zu können ' +
    '(Art. 9 Abs. 2 lit. a DSGVO). Die Einwilligung ist freiwillig und jederzeit mit Wirkung ' +
    'für die Zukunft widerrufbar — per E-Mail an admin@feminity-oberkassel.de.',
  'Mir ist bekannt, dass die Beratung im Salon keine ärztliche Beratung ersetzt.',
];

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
// Zielformat: eine A4-Seite je Bogen. Die Blaetter werden im Salon abgeheftet
// und sollen nicht auseinanderfallen, wobei die Unterschrift ohne den Text
// endet, zu dem sie gehoert. Daher kompakte Grade, enge Abstaende und
// Spaltensatz, wo es die Hoehe halbiert.
const SPALTE_BREITE = 240;
const SPALTE_RECHTS = 267;
const H = 10.5;                                                  // Zwischenüberschriften
const FELD = { spalte: 100, groesse: 9, zeilenhoehe: 11.5 };     // Beschriftung + Wert

function kopfBauen(pdf, bogen) {
  pdf.text('Feminity Oberkassel · Groom&Glow UG (haftungsbeschränkt) · Hansaallee 1a · 40549 Düsseldorf',
    { groesse: 8, abstand: 6 });
  pdf.ueberschrift(bogen.titel, 15, 5);
  pdf.linie(0.6, 0.75, 9);
}

function personBauen(pdf, d) {
  pdf.ueberschrift('Angaben zur Person', H, 3);
  pdf.feld('Name', `${d.vorname} ${d.nachname}`, FELD);
  if (d.geburtsdatum) pdf.feld('Geburtsdatum', datumAusFormular(d.geburtsdatum), FELD);
  if (d.email) pdf.feld('E-Mail', d.email, FELD);
  if (d.telefon) pdf.feld('Telefon', d.telefon, FELD);
  if (d.behandlungsdatum) pdf.feld('Datum der Behandlung', datumAusFormular(d.behandlungsdatum), FELD);
  pdf.luecke(6);
}

function unterschriftBauen(pdf, d, jetzt) {
  pdf.linie(0.6, 0.75, 9);
  pdf.ueberschrift('Unterschrift', H, 3);
  if (d.minderjaehrig) {
    pdf.text('Die unterzeichnende Person ist minderjährig. Es unterschreibt die gesetzliche Vertretung:',
      { groesse: 8.5, abstand: 2 });
    // Ohne Beschriftung — der Satz darüber sagt bereits, wer hier steht.
    pdf.text(d.vertreter || '—', { groesse: 9.5, fett: true, abstand: 4 });
  }
  pdf.bild(d._unterschrift, 200, 62);
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
}

// ── Rumpf: Einwilligung Bild und Ton ────────────────────────────────────────
function koerperEinwilligung(pdf, d) {
  personBauen(pdf, d);

  // Zwei Spalten: links die Aufnahmearten, rechts die Verwendung. y wird
  // gemerkt, die rechte Spalte beginnt wieder oben, danach geht es unterhalb
  // der längeren von beiden weiter.
  const medien = (d.medien || []).filter((m) => MEDIEN[m]);
  const kanaele = (d.kanaele || []).filter((k) => KANAELE[k]);
  const oben = pdf.y;

  pdf.ueberschrift('Art der Aufnahmen', H, 3);
  for (const k of Object.keys(MEDIEN)) {
    pdf.text(`${medien.includes(k) ? '[x]' : '[  ]'}  ${MEDIEN[k]}`,
      { groesse: 9, abstand: 0, breite: SPALTE_BREITE });
  }
  const linksUnten = pdf.y;

  pdf.y = oben;
  pdf.text('Verwendung', { groesse: H, fett: true, abstand: 3, einzug: SPALTE_RECHTS, breite: SPALTE_BREITE });
  for (const k of Object.keys(KANAELE)) {
    pdf.text(`${kanaele.includes(k) ? '[x]' : '[  ]'}  ${KANAELE[k]}`,
      { groesse: 9, abstand: 0, breite: SPALTE_BREITE, einzug: SPALTE_RECHTS });
  }
  pdf.y = Math.min(linksUnten, pdf.y) - 10;

  pdf.ueberschrift('Umfang', H, 3);
  pdf.feld('Namensnennung', d.namensnennung === 'ja'
    ? 'Mein Vorname darf genannt werden'
    : 'Mein Name darf nicht genannt werden', FELD);
  pdf.feld('Erkennbarkeit', d.erkennbar === 'nein'
    ? 'Nur Aufnahmen, auf denen ich nicht erkennbar bin'
    : 'Aufnahmen, auf denen ich erkennbar bin, sind erlaubt', FELD);
  pdf.luecke(6);

  pdf.ueberschrift('Erklärung', H, 3);
  for (const absatz of EINWILLIGUNG_RECHTSTEXT) pdf.text(absatz, { groesse: 8.5, abstand: 5 });
  pdf.luecke(4);
}

// ── Rumpf: Gesundheitsfragebogen ────────────────────────────────────────────
// Aufbau folgt dem Papierbogen des Salons: Angaben, Hautzustand, vier Fragen.
// Die Antwort steht vorn und fett — beim Durchsehen sucht man die Ja-Antworten,
// nicht die Fragen.
function koerperGesundheit(pdf, d) {
  personBauen(pdf, d);

  pdf.ueberschrift('Hautzustand', H, 3);
  const haut = (d.hautzustand || []).filter((x) => GESUNDHEIT.HAUTZUSTAND.some((h) => h.id === x));
  for (const eintrag of GESUNDHEIT.HAUTZUSTAND) {
    pdf.text(`${haut.includes(eintrag.id) ? '[x]' : '[  ]'}  ${eintrag.name}`,
      { groesse: 9, abstand: 0, breite: SPALTE_BREITE });
  }
  pdf.luecke(10);

  pdf.ueberschrift('Gesundheitsfragen', H, 3);
  for (const frage of GESUNDHEIT.FRAGEN) {
    const antwort = d.antworten[frage.id] === 'ja' ? 'Ja' : 'Nein';
    pdf.feld(antwort, frage.frage, { spalte: 30, groesse: 9, zeilenhoehe: 11.5 });
    if (frage.detail) {
      const wert = d.antworten[frage.id] === 'ja' ? (d.details[frage.id] || '—') : '—';
      pdf.text(`${frage.detail} ${wert}`, { groesse: 8.5, abstand: 3, einzug: 30 });
    }
  }
  pdf.luecke(8);

  pdf.ueberschrift('Erklärung', H, 3);
  for (const absatz of GESUNDHEIT_ERKLAERUNG) pdf.text(absatz, { groesse: 8.5, abstand: 5 });
  pdf.luecke(2);
}

// ── Rumpf: Massage ──────────────────────────────────────────────────────────
// Setzt eine Fragengruppe an einem Einzug; gibt zurueck, wo sie endet.
function massageGruppe(pdf, gruppe, d, einzug) {
  pdf.text(gruppe.titel, { groesse: 9.5, fett: true, abstand: 2, einzug, breite: SPALTE_BREITE });
  for (const frage of gruppe.fragen) {
    const antwort = d.antworten[frage.id] === 'ja' ? 'Ja' : 'Nein';
    pdf.feld(antwort, frage.frage,
      { spalte: 26, groesse: 8, zeilenhoehe: 9.8, breite: SPALTE_BREITE, einzug });
    const detail = frage.detail && d.antworten[frage.id] === 'ja' ? (d.details[frage.id] || '') : '';
    if (detail) {
      pdf.text(`${frage.detail} ${detail}`,
        { groesse: 7.5, abstand: 1, einzug: einzug + 26, breite: SPALTE_BREITE - 26 });
    }
  }
  pdf.luecke(5);
}

function koerperMassage(pdf, d) {
  personBauen(pdf, d);

  const gewaehlt = (d.massagen || []).filter((m) => MASSAGE.MASSAGEN.some((x) => x.id === m));
  const oben = pdf.y;

  pdf.ueberschrift('Gewünschte Massage', H, 3);
  pdf.text(
    MASSAGE.MASSAGEN.filter((m) => gewaehlt.includes(m.id)).map((m) => m.name).join(' · ') || '—',
    { groesse: 9, abstand: 0, breite: SPALTE_BREITE }
  );
  const linksUnten = pdf.y;

  pdf.y = oben;
  pdf.text('Druck', { groesse: H, fett: true, abstand: 3, einzug: SPALTE_RECHTS, breite: SPALTE_BREITE });
  const druck = MASSAGE.DRUCK.find((x) => x.id === d.druck);
  pdf.text(druck ? druck.name : '— (keine Angabe)',
    { groesse: 9, abstand: 0, breite: SPALTE_BREITE, einzug: SPALTE_RECHTS });
  pdf.y = Math.min(linksUnten, pdf.y) - 10;

  if (d.schwerpunkt) pdf.feld('Schwerpunkt', d.schwerpunkt, { spalte: 100, groesse: 9, zeilenhoehe: 11.5 });
  if (d.aussparen) pdf.feld('Bitte aussparen', d.aussparen, { spalte: 100, groesse: 9, zeilenhoehe: 11.5 });
  if (d.schwerpunkt || d.aussparen) pdf.luecke(6);

  pdf.ueberschrift('Gesundheitliche Angaben', H, 3);
  const start = pdf.y;
  const haelfte = Math.ceil(MASSAGE.GRUPPEN.length / 2);
  for (const gruppe of MASSAGE.GRUPPEN.slice(0, haelfte)) massageGruppe(pdf, gruppe, d, 0);
  const spalteLinks = pdf.y;

  pdf.y = start;
  for (const gruppe of MASSAGE.GRUPPEN.slice(haelfte)) massageGruppe(pdf, gruppe, d, SPALTE_RECHTS);
  pdf.y = Math.min(spalteLinks, pdf.y) - 4;

  pdf.ueberschrift('Erklärung', H, 3);
  for (const absatz of MASSAGE_ERKLAERUNG) pdf.text(absatz, { groesse: 8, abstand: 4 });
  pdf.luecke(2);
}

// ── Rumpf: Persoenliche Daten und Erreichbarkeit ────────────────────────────
function koerperKontakt(pdf, d) {
  pdf.ueberschrift('Angaben zur Person', H, 3);
  pdf.feld('Name', `${d.vorname} ${d.nachname}`, FELD);
  pdf.feld('E-Mail', d.email || '—', FELD);
  pdf.feld('Mobilnummer', d.mobil || '—', FELD);
  const anschrift = [d.strasse, [d.plz, d.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  pdf.feld('Anschrift', anschrift || '— (freiwillig, nicht angegeben)', FELD);
  pdf.luecke(8);

  pdf.ueberschrift('Dürfen wir uns melden?', H, 3);
  for (const schluessel of Object.keys(KONTAKT)) {
    const antwort = d.antworten[schluessel] === 'ja' ? 'Ja' : 'Nein';
    pdf.feld(antwort, KONTAKT[schluessel], { spalte: 30, groesse: 9, zeilenhoehe: 12.5 });
  }
  pdf.luecke(8);

  pdf.ueberschrift('Erklärung', H, 3);
  for (const absatz of KONTAKT_ERKLAERUNG) pdf.text(absatz, { groesse: 8.5, abstand: 5 });
  pdf.luecke(2);
}

function pdfBauen(bogen, d, unterschrift, jetzt) {
  const pdf = new Pdf();
  d._unterschrift = unterschrift;
  kopfBauen(pdf, bogen);
  bogen.koerper(pdf, d);
  unterschriftBauen(pdf, d, jetzt);
  return pdf.bauen();
}

// Ein 4xx von SMTP ist voruebergehend — Greylisting oder Ratenlimit. Dem Gast
// als endgueltigen Fehler zu zeigen, was Sekunden spaeter durchginge, waere im
// Salon aergerlich: ausgefuellt, unterschrieben, und dann eine Fehlermeldung.
// Wiederholt wird nur, wenn dafuer noch Zeit im Budget der Funktion ist; ein
// langsam gelaufener Zeitablauf soll den zweiten Versuch nicht erzwingen.
const WIEDERHOLUNG_MS = 1500;
const BUDGET_MS = 4000;

async function sendenMitZweitversuch(zugang, mail) {
  const start = Date.now();
  try {
    return await senden(zugang, mail);
  } catch (e) {
    const verbraucht = Date.now() - start;
    if (!e.voruebergehend || verbraucht > BUDGET_MS) throw e;
    console.error(`Fragebogen: ${e.message} — zweiter Versuch`);
    await new Promise((f) => setTimeout(f, WIEDERHOLUNG_MS));
    return senden(zugang, mail);
  }
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

  // Nur uebernehmen, was der Bogen deklariert — alles andere wird verworfen.
  const felder = { minderjaehrig: d.minderjaehrig === true || txt(d.minderjaehrig) === 'ja' };
  for (const name of bogen.text || []) felder[name] = txt(d[name]);
  for (const name of bogen.listen || []) {
    felder[name] = Array.isArray(d[name]) ? d[name].slice(0, 50).map(txt) : [];
  }
  for (const name of bogen.karten || []) {
    const roh = d[name];
    const karte = {};
    if (roh && typeof roh === 'object' && !Array.isArray(roh)) {
      for (const schluessel of Object.keys(roh).slice(0, 100)) karte[txt(schluessel)] = txt(roh[schluessel]);
    }
    felder[name] = karte;
  }

  for (const name of bogen.pflicht) {
    if (!felder[name]) return res.status(400).json({ ok: false, fehler: 'pflicht' });
  }
  if (felder.minderjaehrig && !felder.vertreter) {
    return res.status(400).json({ ok: false, fehler: 'vertreter' });
  }
  if (d.einwilligung !== true) return res.status(400).json({ ok: false, fehler: 'einwilligung' });
  if (bogen.pruefen) {
    const fehler = bogen.pruefen(felder);
    if (fehler) return res.status(400).json({ ok: false, fehler });
  }

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
    await sendenMitZweitversuch(zugang, {
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
        betreff: `Ihr ${bogen.titel} bei Feminity Oberkassel`,
        text:
          `Guten Tag ${felder.vorname} ${felder.nachname},\n\n` +
          `anbei Ihr heute im Salon ausgefüllter Bogen "${bogen.titel}" als PDF — ` +
          'zum Nachlesen und Aufbewahren.\n\n' +
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
