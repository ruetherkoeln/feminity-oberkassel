// Gemeinsame Hilfen der Bogen-Funktionen — /api/fragebogen (Salon) und
// /api/bewerbung (Bewerber). Der Unterstrich im Dateinamen hält Vercel davon
// ab, daraus eine eigene Route zu machen.

const { senden } = require('./_smtp.js');

// Kürzt und säubert einen Formularwert.
const kuerzen = (wert, max) =>
  String(wert === undefined || wert === null ? '' : wert).trim().slice(0, max);

function koerperLesen(req, maxBytes) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((fertig, fehler) => {
    let roh = '';
    req.on('data', (stueck) => {
      roh += stueck;
      if (roh.length > maxBytes) {
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
    console.error(`Bogen: ${e.message} — zweiter Versuch`);
    await new Promise((f) => setTimeout(f, WIEDERHOLUNG_MS));
    return senden(zugang, mail);
  }
}

// SMTP-Zugang aus den Umgebungsvariablen; null, wenn er fehlt.
function smtpZugang() {
  const zugang = {
    host: process.env.SMTP_HOST || 'smtp.ionos.de',
    port: Number(process.env.SMTP_PORT || 465),
    benutzer: process.env.SMTP_BENUTZER,
    passwort: process.env.SMTP_PASSWORT,
  };
  return zugang.benutzer && zugang.passwort ? zugang : null;
}

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

module.exports = {
  kuerzen, koerperLesen, unterschriftLesen, deutschesDatum, datumAusFormular, deutscheZeit,
  sendenMitZweitversuch, smtpZugang, EMAIL_MUSTER,
};
