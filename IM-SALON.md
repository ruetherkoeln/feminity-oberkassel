# Im Salon — Erhebungsbögen

Bögen, die Gäste am Salon-iPad ausfüllen und mit dem Finger unterschreiben.
Das Ergebnis geht als PDF per E-Mail an den Salon; gespeichert wird nichts.

## Was wo liegt

| Datei | Zweck |
|---|---|
| `im-salon.html` | Übersicht mit den Kacheln aller Bögen |
| `im-salon/einwilligung-bild-ton.html` | Bogen: Einwilligung Bild & Ton |
| `im-salon/gesundheitsfragebogen.html` | Bogen: Gesundheitsfragebogen |
| `im-salon/persoenliche-daten.html` | Bogen: Persönliche Daten und Erreichbarkeit |
| `im-salon/massage.html` | Bogen: Vor Ihrer Massage |
| `im-salon/fragen-gesundheit.js` | Fragenkatalog Gesundheit — von Browser **und** Server geladen |
| `im-salon/hairtalk-extensions.html` | Bogen: Hairtalk Extensions — Aufklärung |
| `im-salon/merkblatt-hairtalk.html` | Merkblatt zum Lesen, ohne Unterschrift |
| `im-salon/fragen-massage.js` | Fragenkatalog Massage — ebenso |
| `im-salon/fragen-hairtalk.js` | Bestätigungen Hairtalk — ebenso |
| `im-salon/senden.js` | Absenden mit Wiederholung — von allen vier Bögen genutzt |
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

## Der Fragenkatalog des Gesundheitsbogens

`im-salon/fragen-gesundheit.js` ist die einzige Quelle für die Fragen. Die Datei
wird zweimal geladen: im Browser über `<script src>`, um das Formular zu bauen,
und auf dem Server über `require()`, um die Fragen ins PDF zu schreiben. Deshalb
der doppelte Export am Ende der Datei.

Eine Frage ändern heißt also: nur dort ändern. Die `id` eines Eintrags sollte
dagegen stehen bleiben — sie ist der Schlüssel in der Übertragung, und alte
Bögen im Postfach beziehen sich darauf.

## Einen weiteren Bogen anlegen

1. In `api/fragebogen.js` im Objekt `BOEGEN` einen Eintrag ergänzen:
   - `titel`, `dateiname`, `pflicht`
   - `text` — Namen der einfachen Textfelder, die übernommen werden sollen
   - `listen` — Namen der Mehrfachauswahlen (Arrays)
   - `karten` — Namen der Objekte (wie `antworten` beim Gesundheitsbogen)
   - `koerper` — die Funktion, die den Rumpf ins PDF schreibt
   - optional `pruefen(felder)` für eigene Prüfungen; gibt einen Fehlerschlüssel
     zurück oder `null`

   Übernommen wird **nur**, was der Bogen so deklariert — alles andere verwirft
   der Handler.

2. Eine `koerper`-Funktion schreiben. Kopf, Angaben zur Person, Unterschrift und
   Fußzeile kommen von `kopfBauen()`, `personBauen()` und `unterschriftBauen()`
   und müssen nicht wiederholt werden.

3. Eine HTML-Datei unter `im-salon/` anlegen — am einfachsten als Kopie eines
   bestehenden Bogens; Unterschriftsfeld und Absende-Logik sind darin vollständig
   enthalten.

4. In `im-salon.html` die zugehörige Kachel von `wartet`/`bald` auf einen Link
   mit `status offen` umstellen.

## Kopie an den Gast

Gibt die Person eine E-Mail-Adresse an, geht dasselbe PDF zusätzlich an sie. Das ist
kein Beiwerk: Wer etwas unterschreibt, soll nachlesen können, was darin stand — Art. 7
Abs. 1 DSGVO verlangt, die Einwilligung nachweisen zu können, und die Person hat ein
berechtigtes Interesse an ihrem eigenen Exemplar. Jeder Bogen sagt das mit einem Satz
unter dem E-Mail-Feld, die Übersicht wiederholt es im Hinweiskasten.

Scheitert der Versand der Kopie, gilt der Bogen trotzdem als angekommen — der Eintrag
im Salon-Postfach ist das Original, die Kopie die Zugabe.

## Wenn der Versand klemmt

Zwei Stufen greifen hintereinander:

1. **Server** (`sendenMitZweitversuch` in `api/fragebogen.js`): wiederholt bei einem
   SMTP-4xx genau einmal nach 1,5 Sekunden. Deckt einen kurzen Aussetzer ab.
2. **Browser** (`im-salon/senden.js`): wiederholt drei Minuten lang alle 30 Sekunden,
   sichtbar mit Countdown und Abbrechen-Knopf. Deckt eine Sperre über Minuten ab —
   genau der Fall vom 13.09.2026, als IONOS nach vielen Testmails eine halbe Stunde
   lang nichts mehr annahm.

Bei endgültigen Fehlern (fehlende Pflichtangabe, fehlende Einwilligung, fehlende
Konfiguration) wird **nicht** wiederholt — die beheben sich durch Warten nicht.

Die Angaben liegen währenddessen ausschließlich im Arbeitsspeicher der offenen Seite.
Bewusst nicht in `sessionStorage`: Das Tablet geht von Hand zu Hand. Preis dafür: Wird
die Seite geschlossen, ist der Bogen weg. Ein Rückfallweg, der das PDF stattdessen zum
Sichern anbietet, ist besprochen, aber noch nicht gebaut.

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
