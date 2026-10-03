// POST /api/bewerbung
//
// Nimmt die Bögen des Bewerberbereichs entgegen (/bewerber.html):
//   - bewerberfragebogen  → PDF mit Unterschrift
//   - einstellungsbogen   → PDF mit Unterschrift
//   - ausweispflicht      → Kenntnisnahme des Merkblatts, PDF mit Unterschrift
//   - unterlagen          → hochgeladene Dateien als Anhänge, ohne PDF
// und schickt alles per E-Mail an den Salon. Wie /api/fragebogen wird nichts
// gespeichert — die Daten leben nur für die Dauer dieser Anfrage.
//
// Eigene Funktion statt weiterer Einträge in /api/fragebogen: Bewerber füllen
// zu Hause aus, nicht am Salon-Tablet. Begleittexte, Unterschriftsvermerk und
// Empfängerpostfach unterscheiden sich, und der Upload braucht ein anderes
// Größenlimit als ein Bogen mit Unterschrift.

const { Pdf } = require('./_pdf.js');
const { senden } = require('./_smtp.js');
const {
  kuerzen, koerperLesen, unterschriftLesen, deutschesDatum, datumAusFormular, deutscheZeit,
  sendenMitZweitversuch, smtpZugang, EMAIL_MUSTER,
} = require('./_bogen.js');
const K = require('../bewerber/katalog.js');

// Vercel nimmt höchstens 4,5 MB je Anfrage an. Das Upload-Limit im Katalog
// (3 MB Rohdaten, gut 4 MB als Base64) bleibt darunter.
const MAX_KOERPER = Math.floor(4.4 * 1024 * 1024);
const MAX_FELD = 160;       // Zeichen für einzeilige Angaben
const MAX_LANG = 1500;      // Zeichen für Freitexte

const kurz = (wert) => kuerzen(wert, MAX_FELD);

const ALLE_TEXTE = Object.keys(K.TEXTE).reduce((alle, a) => alle.concat(K.TEXTE[a]), []);
const STUFEN = ['1', '2', '3', '4', '5'].map((id) => ({ id, name: id }));

// ── Bogen-Definitionen ──────────────────────────────────────────────────────
// text:    einzeilige Felder, frei
// auswahl: Felder mit genau einem Wert aus einer Liste — alles andere wird leer
// listen:  Mehrfachauswahl aus einer Liste
// karten:  Objekte id → Wert; Schlüssel und ggf. Werte aus einer Liste
const BOEGEN = {
  bewerberfragebogen: {
    titel: 'Bewerberfragebogen',
    dateiname: 'Bewerberfragebogen',
    pflicht: ['vorname', 'nachname', 'email', 'telefon'],
    text: ['vorname', 'nachname', 'strasse', 'plz', 'ort', 'telefon', 'email', 'geburtsdatum',
           'staatsangehoerigkeit', 'position_sonst', 'eintritt', 'stunden', 'tage', 'gehalt',
           'kuendigung', 'abschluss_sonst', 'portfolio', 'probetag_termine', 'unterschriftsort'],
    auswahl: { probetag: K.JA_NEIN, talentpool: K.JA_NEIN },
    listen: {
      positionen: K.POSITIONEN, modelle: K.MODELLE, abschluesse: K.ABSCHLUESSE,
      unterlagen: K.BEWERBUNGSUNTERLAGEN,
    },
    karten: {
      texte: { schluessel: ALLE_TEXTE, max: MAX_LANG },
      skills: { schluessel: K.SKILLS, werte: K.LEVEL },
      notizen: { schluessel: K.SKILLS },
      aussagen: { schluessel: K.AUSSAGEN, werte: STUFEN },
    },
    pruefen(f) {
      if (!f.positionen.length) return 'position';
      for (const a of K.AUSSAGEN) if (!f.aussagen[a.id]) return 'unvollstaendig';
      return null;
    },
    koerper: koerperBewerbung,
    betreffZusatz: (f) => {
      const namen = f.positionen.map((p) => (p === 'sonstiges' && f.position_sonst
        ? f.position_sonst : K.name(K.POSITIONEN, p)));
      return namen.length ? ` (${namen.join(', ')})` : '';
    },
    kopieText: 'deinen Bewerberfragebogen',
  },

  einstellungsbogen: {
    titel: 'Einstellungsbogen',
    dateiname: 'Einstellungsbogen',
    pflicht: ['vorname', 'nachname', 'geburtsdatum', 'strasse', 'plz', 'ort', 'telefon', 'email',
              'kontoinhaber', 'iban'],
    text: ['vorname', 'nachname', 'geburtsdatum', 'geburtsort', 'staatsangehoerigkeit', 'strasse',
           'plz', 'ort', 'telefon', 'email', 'kinder', 'kinder_geburtsdaten', 'steuerid',
           'steuerklasse', 'konfession_sonst', 'svnummer', 'krankenkasse', 'kvnummer', 'eintritt',
           'position', 'stunden', 'probezeit', 'gehalt', 'kontoinhaber', 'iban', 'bic', 'neben_art',
           'status_details', 'aufenthalt_bis', 'notfall_name', 'notfall_telefon', 'unterschriftsort'],
    auswahl: {
      familienstand: K.FAMILIENSTAND, konfession: K.KONFESSION, freibetraege: K.FREIBETRAEGE,
      rvpflicht: K.RV_PFLICHT, pflege: K.PFLEGE, arbeitszeit: K.ARBEITSZEIT, neben: K.JA_NEIN,
      weitere_sv: K.JA_NEIN, minijob: K.JA_NEIN, status: K.JA_NEIN, aufenthalt: K.AUFENTHALT,
      erlaubnis: K.ERLAUBNIS,
    },
    listen: { unterlagen: K.EINSTELLUNGSUNTERLAGEN },
    karten: {},
    pruefen(f) {
      if (!K.PRUEFEN.iban(f.iban)) return 'iban';
      if (f.steuerid && !K.PRUEFEN.steuerid(f.steuerid)) return 'steuerid';
      if (f.svnummer && !K.PRUEFEN.svnummer(f.svnummer)) return 'svnummer';
      return null;
    },
    koerper: koerperEinstellung,
    betreffZusatz: () => '',
    kopieText: 'deinen Einstellungsbogen',
  },
};

BOEGEN.ausweispflicht = {
  titel: 'Merkblatt Ausweispflicht',
  dateiname: 'Merkblatt-Ausweispflicht',
  pflicht: ['vorname', 'nachname', 'email'],
  text: ['vorname', 'nachname', 'email', 'unterschriftsort'],
  auswahl: { kenntnis: K.JA_NEIN },
  listen: {},
  karten: {},
  // Ohne ausdrückliche Kenntnisnahme ist die Unterschrift wertlos.
  pruefen: (f) => (f.kenntnis === 'ja' ? null : 'kenntnis'),
  koerper: koerperAusweispflicht,
  betreffZusatz: () => ' — zur Kenntnis genommen',
  kopieText: 'deine Bestätigung zum Merkblatt Ausweispflicht',
};

// ── Felder übernehmen ───────────────────────────────────────────────────────
// Nur, was der Bogen deklariert — alles andere wird verworfen.
function felderLesen(bogen, d) {
  const f = {};
  for (const name of bogen.text) f[name] = kurz(d[name]);
  for (const [name, liste] of Object.entries(bogen.auswahl)) {
    const wert = kurz(d[name]);
    f[name] = liste.some((x) => x.id === wert) ? wert : '';
  }
  for (const [name, liste] of Object.entries(bogen.listen)) {
    const roh = Array.isArray(d[name]) ? d[name].map(kurz) : [];
    f[name] = liste.map((x) => x.id).filter((id) => roh.includes(id));
  }
  for (const [name, regel] of Object.entries(bogen.karten)) {
    const roh = d[name] && typeof d[name] === 'object' && !Array.isArray(d[name]) ? d[name] : {};
    const karte = {};
    for (const { id } of regel.schluessel) {
      const wert = kuerzen(roh[id], regel.max || MAX_FELD);
      if (!wert) continue;
      if (regel.werte && !regel.werte.some((x) => x.id === wert)) continue;
      karte[id] = wert;
    }
    f[name] = karte;
  }
  return f;
}

// ── PDF ─────────────────────────────────────────────────────────────────────
// Anders als die Salon-Bögen dürfen diese über mehrere Seiten gehen — der
// Papierbogen hat selbst vier. Wichtig ist nur, dass die Unterschrift nicht
// allein auf einer Seite landet; dafür sorgt der Platzbedarf vor dem Block.
const H = 10.5;
const FELD = { spalte: 150, groesse: 9, zeilenhoehe: 11.5 };
const STRICH = '—';

const abschnitt = (pdf, titel) => { pdf.luecke(4); pdf.ueberschrift(titel, H, 3); };
const feld = (pdf, bezeichnung, wert) => pdf.feld(bezeichnung, wert || STRICH, FELD);
const namen = (liste, ids) => ids.map((id) => K.name(liste, id)).filter(Boolean);

// Frage fett, Antwort darunter — Freitexte sind zu lang für zwei Spalten.
function frageAntwort(pdf, frage, antwort) {
  pdf.text(frage, { groesse: 8.5, fett: true, abstand: 1 });
  pdf.text(antwort || STRICH, { groesse: 9, abstand: 5 });
}

function kopfBauen(pdf, titel, f) {
  pdf.text('Feminity Oberkassel · Groom&Glow UG (haftungsbeschränkt) · Hansaallee 1a · 40549 Düsseldorf',
    { groesse: 8, abstand: 6 });
  pdf.ueberschrift(`${titel}: ${f.vorname} ${f.nachname}`, 15, 5);
  pdf.linie(0.6, 0.75, 6);
}

function erklaerungBauen(pdf, absaetze) {
  abschnitt(pdf, 'Erklärung');
  for (const absatz of absaetze) pdf.text(absatz, { groesse: 8.5, abstand: 4 });
}

function unterschriftBauen(pdf, f, jetzt) {
  pdf.platz(150);
  pdf.linie(0.6, 0.75, 9);
  pdf.ueberschrift('Unterschrift', H, 3);
  pdf.bild(f._unterschrift, 200, 62);
  // Unterschriften reichen oft bis an den unteren Rand des Feldes; ohne
  // diese Lücke berührt der Strich die Datumszeile.
  pdf.luecke(8);
  pdf.text(`${f.unterschriftsort || 'Düsseldorf'}, ${deutschesDatum(jetzt)}`, { groesse: 9, abstand: 1 });
  pdf.text(`${f.vorname} ${f.nachname}`, { groesse: 9, abstand: 8 });
  pdf.linie(0.4, 0.85, 8);
  pdf.text(
    `Online übermittelt am ${deutschesDatum(jetzt)} um ${deutscheZeit(jetzt)} Uhr. ` +
    'Die Unterschrift wurde auf dem Bildschirm gezeichnet.',
    { groesse: 7.5, abstand: 0 }
  );
}

function anschrift(f) {
  return [f.strasse, [f.plz, f.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

function mitSonst(liste, ids, sonst) {
  return ids.map((id) => (id === 'sonstiges' && sonst ? `Sonstiges: ${sonst}` : K.name(liste, id)))
    .join(', ');
}

// ── Rumpf: Bewerberfragebogen ───────────────────────────────────────────────
function koerperBewerbung(pdf, f) {
  abschnitt(pdf, '1. Persönliche Angaben');
  feld(pdf, 'Name', `${f.vorname} ${f.nachname}`);
  feld(pdf, 'Anschrift', anschrift(f));
  feld(pdf, 'Telefon', f.telefon);
  feld(pdf, 'E-Mail', f.email);
  feld(pdf, 'Geburtsdatum', datumAusFormular(f.geburtsdatum));
  feld(pdf, 'Staatsangehörigkeit', f.staatsangehoerigkeit);

  abschnitt(pdf, '2. Wunschposition und Verfügbarkeit');
  feld(pdf, 'Gewünschte Position', mitSonst(K.POSITIONEN, f.positionen, f.position_sonst));
  feld(pdf, 'Frühester Eintritt', datumAusFormular(f.eintritt));
  feld(pdf, 'Beschäftigungsmodell', namen(K.MODELLE, f.modelle).join(', '));
  feld(pdf, 'Wochenstunden', f.stunden);
  feld(pdf, 'Arbeitstage / Zeiten', f.tage);
  feld(pdf, 'Gehaltsvorstellung', f.gehalt);
  feld(pdf, 'Kündigungsfrist', f.kuendigung);

  abschnitt(pdf, '3. Ausbildung und Qualifikationen');
  feld(pdf, 'Abschlüsse', mitSonst(K.ABSCHLUESSE, f.abschluesse, f.abschluss_sonst));
  for (const t of K.TEXTE.ausbildung) frageAntwort(pdf, t.frage, f.texte[t.id]);

  abschnitt(pdf, '4. Berufserfahrung');
  for (const t of K.TEXTE.erfahrung) frageAntwort(pdf, t.frage, f.texte[t.id]);

  abschnitt(pdf, '5. Fachliche Skills (Selbsteinschätzung)');
  // Eigene, breitere Spalte: Die Bezeichnungen sind länger als im übrigen
  // Bogen, und eine Tabelle, deren Werte springen, liest sich schlecht.
  for (const s of K.SKILLS) {
    const level = K.name(K.LEVEL, f.skills[s.id]);
    const notiz = f.notizen[s.id];
    pdf.feld(s.name, [level, notiz].filter(Boolean).join(' · ') || STRICH, { ...FELD, spalte: 215 });
  }

  abschnitt(pdf, '6. Serviceverständnis und Kundenumgang');
  for (const t of K.TEXTE.service) frageAntwort(pdf, t.frage, f.texte[t.id]);

  abschnitt(pdf, '7. Arbeitsweise und Team');
  pdf.text('1 = trifft nicht zu, 5 = trifft zu', { groesse: 8, abstand: 3 });
  for (const a of K.AUSSAGEN) {
    pdf.feld(`${f.aussagen[a.id]} / 5`, a.text, { spalte: 34, groesse: 9, zeilenhoehe: 11.5 });
  }

  abschnitt(pdf, '8. Organisation, Digitalisierung und Social Media');
  for (const t of K.TEXTE.organisation) frageAntwort(pdf, t.frage, f.texte[t.id]);

  abschnitt(pdf, '9. Motivation');
  for (const t of K.TEXTE.motivation) frageAntwort(pdf, t.frage, f.texte[t.id]);
  frageAntwort(pdf, 'Bereit für einen Probetag?',
    [K.name(K.JA_NEIN, f.probetag), f.probetag_termine].filter(Boolean).join(' — Wunschtermine: '));

  abschnitt(pdf, '10. Unterlagen');
  feld(pdf, 'Werden eingereicht', namen(K.BEWERBUNGSUNTERLAGEN, f.unterlagen).join(', '));
  feld(pdf, 'Portfolio / Instagram', f.portfolio);

  erklaerungBauen(pdf, K.ERKLAERUNG_BEWERBUNG);
  pdf.text(`${f.talentpool === 'ja' ? '[x]' : '[  ]'}  ${K.TALENTPOOL}`, { groesse: 8.5, abstand: 4 });
}

// ── Rumpf: Einstellungsbogen ────────────────────────────────────────────────
function koerperEinstellung(pdf, f) {
  const wahl = (liste, id) => K.name(liste, id);

  abschnitt(pdf, '1. Persönliche Daten');
  feld(pdf, 'Name', `${f.vorname} ${f.nachname}`);
  feld(pdf, 'Geburtsdatum / -ort',
    [datumAusFormular(f.geburtsdatum), f.geburtsort].filter(Boolean).join(', '));
  feld(pdf, 'Staatsangehörigkeit', f.staatsangehoerigkeit);
  feld(pdf, 'Anschrift', anschrift(f));
  feld(pdf, 'Telefon', f.telefon);
  feld(pdf, 'E-Mail', f.email);
  feld(pdf, 'Familienstand', wahl(K.FAMILIENSTAND, f.familienstand));
  feld(pdf, 'Kinder (Anzahl)', f.kinder);
  if (f.kinder_geburtsdaten) feld(pdf, 'Geburtsdaten der Kinder', f.kinder_geburtsdaten);

  abschnitt(pdf, '2. Steuerliche Angaben (ELStAM)');
  feld(pdf, 'Steuer-ID', f.steuerid.replace(/\D/g, ''));
  feld(pdf, 'Steuerklasse', f.steuerklasse);
  feld(pdf, 'Konfession', f.konfession === 'sonstige' && f.konfession_sonst
    ? `sonstige: ${f.konfession_sonst}` : wahl(K.KONFESSION, f.konfession));
  feld(pdf, 'Freibeträge / Faktor', wahl(K.FREIBETRAEGE, f.freibetraege));

  abschnitt(pdf, '3. Sozialversicherung');
  feld(pdf, 'SV-Nummer', K.PRUEFEN.nurZeichen(f.svnummer));
  feld(pdf, 'Krankenkasse', f.krankenkasse);
  feld(pdf, 'KV-Mitgliedsnummer', f.kvnummer);
  feld(pdf, 'Rentenversicherungspflicht', wahl(K.RV_PFLICHT, f.rvpflicht));
  feld(pdf, 'Pflegeversicherung', wahl(K.PFLEGE, f.pflege));

  abschnitt(pdf, '4. Beschäftigungsdaten');
  feld(pdf, 'Eintrittsdatum', datumAusFormular(f.eintritt));
  feld(pdf, 'Position / Tätigkeit', f.position);
  feld(pdf, 'Arbeitszeitmodell', wahl(K.ARBEITSZEIT, f.arbeitszeit));
  feld(pdf, 'Wochenstunden', f.stunden);
  feld(pdf, 'Probezeit (Monate)', f.probezeit);
  feld(pdf, 'Vergütung (brutto)', f.gehalt);

  abschnitt(pdf, '5. Bankverbindung');
  feld(pdf, 'Kontoinhaber', f.kontoinhaber);
  feld(pdf, 'IBAN', K.PRUEFEN.nurZeichen(f.iban).replace(/(.{4})/g, '$1 ').trim());
  feld(pdf, 'BIC', f.bic);

  abschnitt(pdf, '6. Weitere Beschäftigungen / Status');
  feld(pdf, 'Nebenbeschäftigung', f.neben === 'ja' && f.neben_art
    ? `ja: ${f.neben_art}` : wahl(K.JA_NEIN, f.neben));
  feld(pdf, 'Weitere SV-pfl. Beschäftigung', wahl(K.JA_NEIN, f.weitere_sv));
  feld(pdf, 'Minijob parallel', wahl(K.JA_NEIN, f.minijob));
  feld(pdf, 'Studium, Ausbildung o. ä.', f.status === 'ja' && f.status_details
    ? `ja: ${f.status_details}` : wahl(K.JA_NEIN, f.status));

  abschnitt(pdf, '7. Arbeitserlaubnis / Aufenthalt');
  feld(pdf, 'Aufenthaltstitel', wahl(K.AUFENTHALT, f.aufenthalt));
  feld(pdf, 'Arbeitserlaubnis', wahl(K.ERLAUBNIS, f.erlaubnis));
  feld(pdf, 'Gültig bis', datumAusFormular(f.aufenthalt_bis));

  abschnitt(pdf, '8. Notfallkontakt');
  feld(pdf, 'Name / Beziehung', f.notfall_name);
  feld(pdf, 'Telefon', f.notfall_telefon);

  abschnitt(pdf, '9. Unterlagen');
  for (const u of K.EINSTELLUNGSUNTERLAGEN) {
    pdf.text(`${f.unterlagen.includes(u.id) ? '[x]' : '[  ]'}  ${u.name}`, { groesse: 9, abstand: 0 });
  }

  erklaerungBauen(pdf, K.ERKLAERUNG_EINSTELLUNG);
}

// ── Rumpf: Merkblatt Ausweispflicht ─────────────────────────────────────────
function koerperAusweispflicht(pdf, f) {
  const A = K.AUSWEISPFLICHT;
  abschnitt(pdf, 'Mitarbeiterin / Mitarbeiter');
  feld(pdf, 'Name', `${f.vorname} ${f.nachname}`);
  feld(pdf, 'E-Mail', f.email);

  abschnitt(pdf, 'Mitführungs- und Vorlagepflicht von Ausweispapieren');
  pdf.text('Liebe Mitarbeiter!', { groesse: 9.5, fett: true, abstand: 4 });
  pdf.text(A.einleitung, { groesse: 9, abstand: 4 });
  pdf.text(A.papiere.join(' · '), { groesse: 9.5, fett: true, abstand: 6, einzug: 14 });

  abschnitt(pdf, 'Was das im Salonalltag bedeutet');
  for (const punkt of A.alltag) pdf.text(`•  ${punkt}`, { groesse: 9, abstand: 3, einzug: 6 });
  pdf.luecke(4);
  pdf.text(`Bußgeld: ${A.bussgeld}`, { groesse: 9, fett: true, abstand: 6 });

  abschnitt(pdf, 'Zur Kenntnis genommen');
  pdf.text(`[x]  ${A.bestaetigung}`, { groesse: 9, abstand: 6 });
  pdf.text(A.aufbewahrung, { groesse: 7.5, abstand: 0 });
}

function pdfBauen(bogen, f, unterschrift, jetzt) {
  const pdf = new Pdf();
  f._unterschrift = unterschrift;
  kopfBauen(pdf, bogen.titel, f);
  bogen.koerper(pdf, f);
  unterschriftBauen(pdf, f, jetzt);
  return pdf.bauen();
}

// ── Unterlagen ──────────────────────────────────────────────────────────────
// Erkannt wird am Inhalt, nicht an Dateiname oder Typangabe des Browsers.
const FORMATE = [
  { endung: 'pdf', typ: 'application/pdf', passt: (b) => b.slice(0, 5).toString('latin1') === '%PDF-' },
  { endung: 'jpg', typ: 'image/jpeg', passt: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { endung: 'png', typ: 'image/png', passt: (b) => b.slice(0, 4).toString('hex') === '89504e47' },
];

// Dateinamen im Anhang: nur ASCII, sonst bräuchte der Mailkopf RFC 2231.
function dateinamenTeil(text) {
  return String(text)
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Datei';
}

function dateienLesen(roh) {
  if (!Array.isArray(roh) || !roh.length) return { fehler: 'dateien' };
  if (roh.length > K.UPLOAD.MAX_DATEIEN) return { fehler: 'zuviele' };
  const dateien = [];
  let summe = 0;
  for (const eintrag of roh) {
    const b64 = String((eintrag && eintrag.daten) || '');
    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return { fehler: 'datei' };
    const daten = Buffer.from(b64, 'base64');
    const format = FORMATE.find((x) => x.passt(daten));
    if (!format) return { fehler: 'datei' };
    summe += daten.length;
    if (summe > K.UPLOAD.MAX_BYTES) return { fehler: 'zugross' };
    const art = K.DOKUMENTARTEN.some((x) => x.id === eintrag.art) ? eintrag.art : 'sonstiges';
    dateien.push({ daten, format, art, original: kurz(eintrag.name) || 'ohne Namen' });
  }
  return { dateien, summe };
}

const groesse = (bytes) => (bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

async function unterlagenVerarbeiten(d, res, zugang, an, von) {
  const f = {
    vorname: kurz(d.vorname), nachname: kurz(d.nachname), email: kurz(d.email),
    telefon: kurz(d.telefon), nachricht: kuerzen(d.nachricht, MAX_LANG),
    anlass: d.anlass === 'einstellung' ? 'einstellung' : 'bewerbung',
  };
  if (!f.vorname || !f.nachname || !f.email) return res.status(400).json({ ok: false, fehler: 'pflicht' });
  if (!EMAIL_MUSTER.test(f.email)) return res.status(400).json({ ok: false, fehler: 'email' });
  if (d.einwilligung !== true) return res.status(400).json({ ok: false, fehler: 'einwilligung' });

  const gelesen = dateienLesen(d.dateien);
  if (gelesen.fehler) return res.status(400).json({ ok: false, fehler: gelesen.fehler });

  const jetzt = new Date();
  const person = dateinamenTeil(`${f.nachname}-${f.vorname}`);
  const tag = jetzt.toISOString().slice(0, 10);
  const anhaenge = gelesen.dateien.map((x, i) => ({
    name: `${dateinamenTeil(K.name(K.DOKUMENTARTEN, x.art))}_${person}_${tag}_${i + 1}.${x.format.endung}`,
    typ: x.format.typ,
    daten: x.daten,
  }));
  const liste = gelesen.dateien.map((x, i) =>
    `${i + 1}. ${K.name(K.DOKUMENTARTEN, x.art)} — ${x.original} (${groesse(x.daten.length)})`).join('\n');
  const anlass = f.anlass === 'einstellung' ? 'Unterlagen zur Einstellung' : 'Bewerbungsunterlagen';

  try {
    await sendenMitZweitversuch(zugang, {
      von,
      vonName: 'Feminity Oberkassel — Bewerbung',
      an,
      betreff: `${anlass}: ${f.vorname} ${f.nachname} (${anhaenge.length} ${anhaenge.length === 1 ? 'Datei' : 'Dateien'})`,
      text:
        `${anlass}\n\n` +
        `Name:      ${f.vorname} ${f.nachname}\n` +
        `E-Mail:    ${f.email}\n` +
        (f.telefon ? `Telefon:   ${f.telefon}\n` : '') +
        `Eingang:   ${deutschesDatum(jetzt)} um ${deutscheZeit(jetzt)} Uhr\n\n` +
        `Dateien im Anhang:\n${liste}\n` +
        (f.nachricht ? `\nNachricht:\n${f.nachricht}\n` : ''),
      anhaenge,
    });
  } catch (e) {
    console.error('Bewerbung: Versand der Unterlagen fehlgeschlagen —', e.message);
    return res.status(502).json({ ok: false, fehler: 'versand' });
  }

  // Eingangsbestätigung ohne Anhänge — die Person hat die Dateien ja selbst.
  try {
    await senden(zugang, {
      von,
      vonName: 'Feminity Oberkassel',
      an: f.email,
      betreff: 'Deine Unterlagen sind bei Feminity Oberkassel angekommen',
      text:
        `Hallo ${f.vorname},\n\n` +
        `vielen Dank — folgende Dateien sind bei uns angekommen:\n\n${liste}\n\n` +
        'Wir melden uns bei dir.\n\n' +
        'Herzliche Grüße\nDein Team von Feminity Oberkassel\n' +
        'Hansaallee 1a · 40549 Düsseldorf',
    });
  } catch (e) {
    console.error('Bewerbung: Eingangsbestätigung fehlgeschlagen —', e.message);
  }

  return res.status(200).json({ ok: true });
}

// ── Handler ─────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, fehler: 'Nur POST' });
  }

  let d;
  try {
    d = await koerperLesen(req, MAX_KOERPER);
  } catch (e) {
    return res.status(400).json({ ok: false, fehler: e.message });
  }

  // Honigtopf: Bots füllen versteckte Felder aus. Still mit Erfolg antworten.
  if (kurz(d.webseite)) return res.status(200).json({ ok: true });

  const art = kurz(d.bogen);
  const bogen = BOEGEN[art];
  if (!bogen && art !== 'unterlagen') return res.status(400).json({ ok: false, fehler: 'Unbekannter Bogen' });

  const zugang = smtpZugang();
  if (!zugang) {
    console.error('Bewerbung: SMTP-Zugangsdaten fehlen');
    return res.status(500).json({ ok: false, fehler: 'konfiguration' });
  }
  // Dasselbe Postfach wie die Salon-Bögen — so vom Salon gewünscht (03.10.2026).
  const an = process.env.MAIL_AN || 'fragebogen@feminity-oberkassel.com';
  const von = process.env.MAIL_VON || zugang.benutzer;

  if (art === 'unterlagen') return unterlagenVerarbeiten(d, res, zugang, an, von);

  const f = felderLesen(bogen, d);
  for (const name of bogen.pflicht) {
    if (!f[name]) return res.status(400).json({ ok: false, fehler: 'pflicht' });
  }
  if (!EMAIL_MUSTER.test(f.email)) return res.status(400).json({ ok: false, fehler: 'email' });
  if (d.einwilligung !== true) return res.status(400).json({ ok: false, fehler: 'einwilligung' });
  const fehler = bogen.pruefen(f);
  if (fehler) return res.status(400).json({ ok: false, fehler });

  const unterschrift = unterschriftLesen(d.signatur);
  if (!unterschrift) return res.status(400).json({ ok: false, fehler: 'signatur' });

  const jetzt = new Date();
  let pdf;
  try {
    pdf = pdfBauen(bogen, f, unterschrift, jetzt);
  } catch (e) {
    console.error('Bewerbung: PDF fehlgeschlagen —', e.message);
    return res.status(500).json({ ok: false, fehler: 'pdf' });
  }

  const datei = `${bogen.dateiname}_${dateinamenTeil(`${f.nachname}-${f.vorname}`)}_${jetzt.toISOString().slice(0, 10)}.pdf`;
  const anhang = { name: datei, typ: 'application/pdf', daten: pdf };

  try {
    await sendenMitZweitversuch(zugang, {
      von,
      vonName: 'Feminity Oberkassel — Bewerbung',
      an,
      betreff: `${bogen.titel}: ${f.vorname} ${f.nachname}${bogen.betreffZusatz(f)}`,
      text:
        `${bogen.titel}\n\n` +
        `Name:      ${f.vorname} ${f.nachname}\n` +
        `E-Mail:    ${f.email}\n` +
        (f.telefon ? `Telefon:   ${f.telefon}\n` : '') +
        `Eingang:   ${deutschesDatum(jetzt)} um ${deutscheZeit(jetzt)} Uhr\n\n` +
        'Der unterschriebene Bogen liegt als PDF im Anhang.',
      anhang,
    });
  } catch (e) {
    // Ohne Details: die Eingaben gehören nicht ins Log
    console.error('Bewerbung: Versand fehlgeschlagen —', e.message);
    return res.status(502).json({ ok: false, fehler: 'versand' });
  }

  // Kopie an die Person — sie soll nachlesen können, was sie unterschrieben hat.
  // Scheitert sie, ist der Bogen trotzdem angekommen.
  try {
    await senden(zugang, {
      von,
      vonName: 'Feminity Oberkassel',
      an: f.email,
      betreff: `Dein ${bogen.titel} bei Feminity Oberkassel`,
      text:
        `Hallo ${f.vorname},\n\n` +
        `vielen Dank — wir haben ${bogen.kopieText} erhalten. Anbei dein Exemplar als PDF ` +
        'zum Nachlesen und Aufbewahren.\n\n' +
        'Herzliche Grüße\nDein Team von Feminity Oberkassel\n' +
        'Hansaallee 1a · 40549 Düsseldorf',
      anhang,
    });
  } catch (e) {
    console.error('Bewerbung: Kopie an die Person fehlgeschlagen —', e.message);
  }

  return res.status(200).json({ ok: true });
};
