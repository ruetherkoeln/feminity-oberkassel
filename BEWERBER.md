# Bewerber — Bögen und Unterlagen

Versteckter Bereich für Bewerberinnen, Bewerber und neue Kolleginnen:
**https://feminity-oberkassel.de/bewerber** — nicht verlinkt, nicht in der Sitemap,
`noindex` per Meta **und** `X-Robots-Tag` aus `vercel.json`. Der Link wird gezielt
verschickt (Stellenanzeige, WhatsApp, Mail).

Technisch ein Geschwister von `/im-salon` (siehe `IM-SALON.md`): Bogen als PDF,
Versand über IONOS, nichts wird gespeichert. Unterschied: Hier wird meist am eigenen
Handy ausgefüllt, nicht am Salon-Tablet.

## Was wo liegt

| Datei | Zweck |
|---|---|
| `bewerber.html` | Übersicht mit drei Kacheln |
| `bewerber/bewerberfragebogen.html` | Bogen nach der Papiervorlage „Bewerberfragebogen“ (10 Abschnitte) |
| `bewerber/einstellungsbogen.html` | Bogen nach der Papiervorlage „Einstellungsbogen“ — erst nach Zusage |
| `bewerber/ausweispflicht.html` | Merkblatt Ausweispflicht (§ 2a SchwarzArbG) lesen und Kenntnisnahme unterschreiben |
| `bewerber/merkblatt-ausweispflicht.pdf` | Das Papier-Merkblatt zum Ausdrucken (verlinkt von der Seite) |
| `bewerber/unterlagen.html` | Upload: Zertifikate, Nachweise, Zeugnisse, Kopien für die Personalakte |
| `bewerber/katalog.js` | Positionen, Skills, Fragen, Rechtstexte, Merkblatt-Wortlaut, Prüfungen (IBAN, Steuer-ID) — von Browser **und** Server geladen |
| `bewerber/bogen.js` | Gemeinsame Bausteine der drei Seiten (Auswahlknöpfe, Einsammeln, Pflichtprüfung, Unterschrift, Versandanzeige) |
| `bewerber/bogen.css` | Gemeinsames Aussehen |
| `api/bewerbung.js` | Serverfunktion für alle drei |
| `api/_bogen.js` | Hilfen, die `api/fragebogen.js` und `api/bewerbung.js` teilen |

Die Wiederholung bei Versandstörungen kommt aus `im-salon/senden.js` (drei Minuten,
alle 30 Sekunden) — mit `/api/bewerbung` als Ziel.

## Empfänger

| Variable | Wirkung |
|---|---|
| `MAIL_AN_BEWERBUNG` | Postfach für alles aus dem Bewerberbereich |
| sonst `MAIL_AN` | wie die Salon-Bögen |
| sonst | `fragebogen@feminity-oberkassel.com` |

Der Einstellungsbogen enthält Gehalt, IBAN, Steuer-ID und Konfession. Wer das
Salon-Postfach liest, liest ohne eigene Variable also auch das mit.

Bewerber bekommen eine Kopie ihres PDFs an die angegebene Adresse; beim Upload
eine Eingangsbestätigung mit der Dateiliste (ohne Anhänge).

## Upload-Grenzen

Vercel nimmt höchstens **4,5 MB je Anfrage** an. Deshalb: höchstens **10 Dateien und
3 MB je Durchgang** (`UPLOAD` in `katalog.js`). Fotos werden im Browser auf 2000 px
lange Kante verkleinert (JPEG, Qualität 0,82) — ein 4-MB-Handyfoto wird so zu wenigen
hundert KB. PDFs gehen unverändert. Wer mehr hat, schickt einen zweiten Durchgang;
die Danke-Seite bietet das an und behält Name und E-Mail.

Der Server erkennt das Format am Inhalt (PDF, JPEG, PNG), nicht am Dateinamen.

## Fragen oder Wortlaut ändern

Nur in `bewerber/katalog.js`. Formular und PDF lesen beide daraus. Die `id` stehen
lassen — sie sind die Schlüssel in der Übertragung. Neue Freitextfrage: in `TEXTE`
im passenden Abschnitt ergänzen, sie erscheint automatisch in Formular und PDF.

## Prüfungen

- **IBAN:** Prüfsumme nach ISO 13616, deutsche IBAN 22 Stellen. Pflicht.
- **Steuer-ID:** elf Ziffern mit Prüfziffer nach § 139b AO. Freiwillig, aber wenn
  angegeben, muss sie stimmen.
- **SV-Nummer:** nur die Form (8 Ziffern, Buchstabe, 3 Ziffern) — bewusst ohne
  Prüfziffer, damit keine richtige Nummer an einer zu strengen Regel scheitert.

## Noch zu klären

- Rechtstexte (Erklärungen in `katalog.js`, Datenschutzhinweise) sind von Claude
  formuliert, nicht juristisch geprüft. Löschfrist sechs Monate nach Abschluss des
  Verfahrens (AGG), Talentpool zwölf Monate mit Einwilligung.
- Die Datenschutzerklärung der Website (`impressum.html`) erwähnt den Bewerberbereich
  noch nicht.
