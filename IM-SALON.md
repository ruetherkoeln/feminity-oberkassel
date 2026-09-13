# Im Salon — Erhebungsbögen

Bögen, die Gäste am Salon-iPad ausfüllen und mit dem Finger unterschreiben.
Das Ergebnis geht als PDF per E-Mail an den Salon; gespeichert wird nichts.

## Was wo liegt

| Datei | Zweck |
|---|---|
| `im-salon.html` | Übersicht mit den Kacheln aller Bögen |
| `im-salon/einwilligung-bild-ton.html` | Erster Bogen: Einwilligung Bild & Ton |
| `api/fragebogen.js` | Nimmt den Bogen entgegen, baut das PDF, verschickt es |
| `api/_pdf.js` | PDF-Erzeuger |
| `api/_smtp.js` | Mailversand über SMTP |

## Warum ohne Bibliotheken

Die Website ist eine Sammlung statischer HTML-Dateien ohne `package.json`.
Jede Abhängigkeit würde einen Installations- und Build-Schritt erzwingen und
damit den Live-Betrieb des Salons an einen Build koppeln. PDF-Erzeugung und
SMTP sind deshalb von Hand geschrieben — beides mit Node-Bordmitteln.

Zwei Folgen daraus, die man kennen sollte:

- **Die Unterschrift wird als JPEG übertragen, nicht als PNG.** Ein Baseline-JPEG
  lässt sich unverändert als `/DCTDecode` ins PDF legen. PNG müsste erst entpackt
  und neu komprimiert werden, wofür es eine Bibliothek bräuchte.
- **Der Text nutzt Helvetica in WinAnsi-Kodierung.** Das deckt Umlaute, ß, § und
  die deutschen Anführungszeichen ab. Zeichen außerhalb von cp1252 — etwa
  kyrillische oder türkische Sonderzeichen — werden zu `?`. Bei Namen mit solchen
  Zeichen müsste eine echte Schrift eingebettet werden.

## Umgebungsvariablen

In Vercel unter *Settings → Environment Variables* setzen, für **Production**
und **Preview**:

| Variable | Wert | Pflicht |
|---|---|---|
| `SMTP_BENUTZER` | Postfachname bei IONOS, meist die volle Adresse | ja |
| `SMTP_PASSWORT` | Passwort dieses Postfachs | ja |
| `SMTP_HOST` | Standard `smtp.ionos.de` | nein |
| `SMTP_PORT` | Standard `465` (TLS) | nein |
| `MAIL_VON` | Absenderadresse; Standard = `SMTP_BENUTZER` | nein |
| `MAIL_AN` | Standard `fragebogen@feminity-oberkassel.com` | nein |

Der Absender muss zum Postfach gehören — IONOS lehnt fremde Absenderadressen ab.

## Einen weiteren Bogen anlegen

1. In `api/fragebogen.js` im Objekt `BOEGEN` einen Eintrag ergänzen: `titel`,
   `dateiname`, `pflicht` und den `rechtstext`, der ins PDF wandert.
2. Den Abschnitt in `pdfBauen()` um die neuen Felder erweitern.
3. Eine HTML-Datei unter `im-salon/` anlegen — am einfachsten als Kopie von
   `einwilligung-bild-ton.html`; Unterschriftsfeld und Absende-Logik sind darin
   vollständig enthalten und müssen nur um die neuen Felder ergänzt werden.
4. In `im-salon.html` die zugehörige Kachel von `wartet`/`bald` auf einen Link
   mit `status offen` umstellen.

## Datenschutz

- Beide Seiten sind auf `noindex` gesetzt, zusätzlich greift ein `X-Robots-Tag`
  aus `vercel.json` für alles unter `/im-salon`. Sie stehen weder in der
  Navigation noch in der Sitemap.
- Die Funktion legt nichts ab: keine Datenbank, keine Datei, kein Log mit
  Inhalten. Fehlermeldungen enthalten bewusst keine Eingaben.
- Nach dem Absenden wird das Formular geleert, damit auf dem geteilten Tablet
  nichts von der Vorgängerin stehen bleibt.
- Gibt die Person eine E-Mail-Adresse an, bekommt sie ihre Einwilligung als
  Kopie — Nachweis für sie, Transparenz nach Art. 7 Abs. 1 DSGVO.

### Noch zu klären

- **Auftragsverarbeitung mit Vercel.** Das Projekt liegt auf dem Hobby-Plan;
  Vercels AVV gilt laut deren DPA nur für Pro und Enterprise. Für Bild- und
  Ton-Einwilligungen ist das vertretbar, für Bögen mit **Gesundheitsdaten**
  (PMU, Laser, Infusionen) sollte vorher ein AVV stehen — also Pro-Plan.
- **Aufbewahrung.** Im Postfach liegende Einwilligungen sollten nach Widerruf
  oder Ende der Nutzung gelöscht werden. Dafür braucht es eine Routine im Salon,
  die Technik kann das nicht übernehmen.
