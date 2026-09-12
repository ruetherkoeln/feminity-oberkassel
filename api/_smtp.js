// Minimaler SMTP-Versand über TLS, ohne Abhängigkeiten.
//
// Warum kein nodemailer: siehe _pdf.js — die Site soll ohne package.json
// und ohne Build-Schritt auskommen. Für einen einzigen Empfänger mit einem
// Anhang ist SMTP überschaubar genug.
//
// Warum überhaupt eigener Mailserver statt eines Versanddienstes: Die
// Bögen enthalten personenbezogene Daten. Über IONOS bleibt die Zustellung
// innerhalb der Infrastruktur des Salons; ein Dienst wie Resend wäre ein
// weiterer Auftragsverarbeiter, der die Inhalte zu sehen bekäme.

const tls = require('tls');

const ZEITLIMIT = 20000;

function base64(text) {
  return Buffer.from(String(text), 'utf8').toString('base64');
}

// Betreffzeilen mit Umlauten brauchen die Kodierung nach RFC 2047.
function kopfzeileKodieren(text) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function base64Bloecke(buf, breite = 76) {
  const roh = buf.toString('base64');
  const zeilen = [];
  for (let i = 0; i < roh.length; i += breite) zeilen.push(roh.slice(i, i + breite));
  return zeilen.join('\r\n');
}

// ── Verbindung ──────────────────────────────────────────────────────────────
class Verbindung {
  constructor(socket) {
    this.socket = socket;
    this.puffer = '';
    this.warteschlange = [];
    socket.setEncoding('utf8');
    socket.on('data', (stueck) => {
      this.puffer += stueck;
      this.pruefen();
    });
  }

  // Eine SMTP-Antwort endet mit "NNN " (Leerzeichen statt Bindestrich).
  pruefen() {
    let zeilen = this.puffer.split('\r\n');
    for (let i = 0; i < zeilen.length - 1; i++) {
      if (/^\d{3} /.test(zeilen[i])) {
        const antwort = zeilen.slice(0, i + 1).join('\r\n');
        this.puffer = zeilen.slice(i + 1).join('\r\n');
        const auftrag = this.warteschlange.shift();
        if (auftrag) auftrag(antwort);
        return this.pruefen();
      }
    }
  }

  antwort() {
    return new Promise((fertig) => this.warteschlange.push(fertig));
  }

  async befehl(text, erwartet) {
    if (text !== null) this.socket.write(text + '\r\n');
    const antwort = await this.antwort();
    const code = parseInt(antwort.slice(0, 3), 10);
    if (!erwartet.includes(code)) {
      // Zugangsdaten dürfen nicht ins Log geraten
      const gezeigt = text && /^AUTH|^[A-Za-z0-9+/=]{8,}$/.test(text) ? '(Zugangsdaten)' : text;
      throw new Error(`SMTP ${code} auf "${gezeigt}": ${antwort.split('\r\n')[0]}`);
    }
    return antwort;
  }
}

/**
 * Verschickt eine Nachricht mit genau einem Anhang.
 *
 * zugang: { host, port, benutzer, passwort }
 * mail:   { von, vonName, an, betreff, text, anhang: { name, typ, daten } }
 */
async function senden(zugang, mail) {
  const socket = tls.connect({
    host: zugang.host,
    port: zugang.port || 465,
    servername: zugang.host,
  });
  socket.setTimeout(ZEITLIMIT);

  await new Promise((fertig, fehler) => {
    socket.once('secureConnect', fertig);
    socket.once('error', fehler);
    socket.once('timeout', () => fehler(new Error('Zeitüberschreitung beim Verbinden')));
  });

  const v = new Verbindung(socket);
  try {
    await v.befehl(null, [220]);                              // Begrüßung
    await v.befehl(`EHLO ${zugang.host}`, [250]);
    await v.befehl('AUTH LOGIN', [334]);
    await v.befehl(base64(zugang.benutzer), [334]);
    await v.befehl(base64(zugang.passwort), [235]);
    await v.befehl(`MAIL FROM:<${mail.von}>`, [250]);
    await v.befehl(`RCPT TO:<${mail.an}>`, [250, 251]);
    await v.befehl('DATA', [354]);

    const grenze = '=_feminity_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const kopf = [
      `From: ${kopfzeileKodieren(mail.vonName || mail.von)} <${mail.von}>`,
      `To: <${mail.an}>`,
      `Subject: ${kopfzeileKodieren(mail.betreff)}`,
      `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${grenze}"`,
      '',
      `--${grenze}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64Bloecke(Buffer.from(mail.text, 'utf8')),
      `--${grenze}`,
      `Content-Type: ${mail.anhang.typ}; name="${mail.anhang.name}"`,
      `Content-Disposition: attachment; filename="${mail.anhang.name}"`,
      'Content-Transfer-Encoding: base64',
      '',
      base64Bloecke(mail.anhang.daten),
      `--${grenze}--`,
      '',
    ].join('\r\n');

    // Punkt am Zeilenanfang verdoppeln, sonst endet die Nachricht zu früh
    socket.write(kopf.replace(/\r\n\./g, '\r\n..'));
    await v.befehl('\r\n.', [250]);
    await v.befehl('QUIT', [221]).catch(() => {});
  } finally {
    socket.end();
  }
}

module.exports = { senden };
