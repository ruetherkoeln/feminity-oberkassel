// Kataloge des Bewerberbereichs — einzige Quelle für Formulare UND PDF.
//
// Grundlage sind die Papiervorlagen des Salons (Bewerberfragebogen und
// Einstellungsbogen, Ordner "Personal und Suche"). Reihenfolge und Wortlaut
// folgen ihnen, damit der digitale Bogen und der Papierbogen nebeneinander
// gelesen werden können.
//
// Diese Datei wird zweimal geladen: im Browser über <script src> und auf dem
// Server über require(). Wortlaut ändern: nur hier. Die `id` stehen lassen —
// sie ist der Schlüssel in der Übertragung.

(function (global) {
  'use strict';

  // ── Bewerberfragebogen ──────────────────────────────────────────────────
  var POSITIONEN = [
    { id: 'hairstylist', name: 'Hairstylist' },
    { id: 'colorist', name: 'Colorist' },
    { id: 'makeup', name: 'Make-up Artist' },
    { id: 'kosmetik', name: 'Kosmetik' },
    { id: 'rezeption', name: 'Rezeption / Assistenz' },
    { id: 'ausbildung', name: 'Ausbildung' },
    { id: 'aushilfe', name: 'Aushilfe' },
    { id: 'sonstiges', name: 'Sonstiges' },
  ];

  var MODELLE = [
    { id: 'vollzeit', name: 'Vollzeit' },
    { id: 'teilzeit', name: 'Teilzeit' },
    { id: 'minijob', name: 'Minijob' },
    { id: 'frei', name: 'Freie Mitarbeit' },
    { id: 'ausbildung', name: 'Ausbildung' },
  ];

  var ABSCHLUESSE = [
    { id: 'friseur', name: 'Friseur-Ausbildung' },
    { id: 'meister', name: 'Friseur-Meister' },
    { id: 'kosmetik', name: 'Kosmetik-Ausbildung' },
    { id: 'visagistik', name: 'Visagistik' },
    { id: 'sonstiges', name: 'Sonstiges' },
  ];

  var LEVEL = [
    { id: 'basic', name: 'Basic' },
    { id: 'gut', name: 'Gut' },
    { id: 'sehrgut', name: 'Sehr gut' },
    { id: 'experte', name: 'Experte' },
  ];

  var SKILLS = [
    { id: 'damen', name: 'Damenhaarschnitte (kurz, mittel, lang)' },
    { id: 'herren', name: 'Herrenhaarschnitte / Barber Basics' },
    { id: 'styling', name: 'Föhnen / Styling / Finish' },
    { id: 'hochstecken', name: 'Hochstecken / Event-Styling' },
    { id: 'ansatz', name: 'Ansatzfarbe / Grauabdeckung' },
    { id: 'straehnen', name: 'Strähnen (Folien) / Babylights' },
    { id: 'balayage', name: 'Balayage / Freihand-Techniken' },
    { id: 'blond', name: 'Blondierungen / Tonings / Glossings' },
    { id: 'korrektur', name: 'Farbkorrekturen (Color Correction)' },
    { id: 'extensions', name: 'Extensions (Tape-In, Weft, Bonding)' },
    { id: 'keratin', name: 'Keratin / Glättung / Pflegebehandlungen' },
    { id: 'braids', name: 'Braids / Afro Hair / Protective Styles' },
    { id: 'makeup', name: 'Make-up (Day, Evening, Bridal)' },
    { id: 'brows', name: 'Brows & Lashes (Färben, Lifting, Styling)' },
    { id: 'kosmetik', name: 'Kosmetikbehandlungen / Hautpflege' },
  ];

  // 1 = trifft nicht zu, 5 = trifft zu
  var AUSSAGEN = [
    { id: 'zuverlaessig', text: 'Ich arbeite zuverlässig und pünktlich.' },
    { id: 'auslastung', text: 'Ich halte auch bei hoher Auslastung die Servicequalität hoch.' },
    { id: 'hygiene', text: 'Ich arbeite sorgfältig und achte konsequent auf Hygiene.' },
    { id: 'team', text: 'Ich bin teamfähig und unterstütze Kollegen aktiv.' },
    { id: 'feedback', text: 'Ich nehme Feedback an und setze es um.' },
    { id: 'eigenstaendig', text: 'Ich arbeite eigenständig und strukturiert.' },
    { id: 'flexibel', text: 'Ich bin flexibel bei Arbeitszeiten (inkl. Samstage).' },
    { id: 'lernbereit', text: 'Ich bin lernbereit und offen für neue Techniken und Trends.' },
  ];

  // Freitexte, nach Abschnitten. `lang` = mehrzeiliges Feld.
  var TEXTE = {
    ausbildung: [
      { id: 'ausbildungsort', frage: 'Ausbildungsbetrieb / Schule / Institut' },
      { id: 'abschlussjahr', frage: 'Abschluss / Jahr' },
      { id: 'zusatz', frage: 'Zusatzqualifikationen (z. B. Balayage, Blond, Extensions)', lang: true },
      { id: 'zertifikate', frage: 'Zertifikate / Schulungen', lang: true },
      { id: 'sprachen', frage: 'Sprachen (mit Niveau)' },
    ],
    erfahrung: [
      { id: 'arbeitgeber', frage: 'Aktueller oder letzter Arbeitgeber (Salon) und Ort' },
      { id: 'zeitraum', frage: 'Position und Zeitraum' },
      { id: 'aufgaben', frage: 'Hauptaufgaben und Verantwortungsbereich', lang: true },
      { id: 'stationen', frage: 'Weitere Stationen (kurz) / Erfahrung als Freelancer', lang: true },
      { id: 'premium', frage: 'Erfahrung mit Premium- oder Laufkundschaft (ja/nein, Beispiele)', lang: true },
    ],
    service: [
      { id: 'service', frage: 'Was bedeutet für Sie exzellenter Service im Salon?', lang: true },
      { id: 'reklamation', frage: 'Wie gehen Sie mit Reklamationen um? (kurzes Beispiel)', lang: true },
      { id: 'qualitaet', frage: 'Wie sichern Sie Qualität und Beratung ab? (Ablauf)', lang: true },
      { id: 'verkauf', frage: 'Wie stehen Sie zu Produktberatung und Verkauf im Salon?', lang: true },
      { id: 'staerken', frage: 'Ihre zwei bis drei größten Stärken im Kundenkontakt', lang: true },
    ],
    organisation: [
      { id: 'kasse', frage: 'Erfahrung mit Termin- und Kassensystemen (z. B. Treatwell, Shore, Planity)' },
      { id: 'lager', frage: 'Erfahrung mit Warenwirtschaft, Lager und Bestellungen' },
      { id: 'content', frage: 'Social Media: Bereitschaft zu Content und Vorher-Nachher-Aufnahmen (ja/nein, Erfahrung)', lang: true },
      { id: 'kundenfotos', frage: 'Datenschutz: Erfahrung im Umgang mit Kundenfotos (ja/nein)' },
    ],
    motivation: [
      { id: 'warum', frage: 'Warum möchten Sie bei Feminity Oberkassel arbeiten?', lang: true },
      { id: 'kunden', frage: 'Welche Kunden und Services liegen Ihnen besonders?', lang: true },
      { id: 'ziele', frage: 'Welche Ziele haben Sie für die nächsten zwölf Monate?', lang: true },
    ],
  };

  var BEWERBUNGSUNTERLAGEN = [
    { id: 'lebenslauf', name: 'Lebenslauf' },
    { id: 'zeugnisse', name: 'Zeugnisse' },
    { id: 'zertifikate', name: 'Zertifikate' },
    { id: 'portfolio', name: 'Portfolio / Instagram-Link' },
    { id: 'referenzen', name: 'Referenzen' },
  ];

  // ── Einstellungsbogen ───────────────────────────────────────────────────
  var FAMILIENSTAND = [
    { id: 'ledig', name: 'ledig' },
    { id: 'verheiratet', name: 'verheiratet' },
    { id: 'geschieden', name: 'geschieden' },
    { id: 'verwitwet', name: 'verwitwet' },
  ];

  var KONFESSION = [
    { id: 'keine', name: 'keine' },
    { id: 'rk', name: 'röm.-kath.' },
    { id: 'ev', name: 'evangelisch' },
    { id: 'sonstige', name: 'sonstige' },
  ];

  var FREIBETRAEGE = [
    { id: 'nein', name: 'nein' },
    { id: 'ja', name: 'ja, Nachweis folgt' },
  ];

  var RV_PFLICHT = [
    { id: 'ja', name: 'ja' },
    { id: 'nein', name: 'nein' },
    { id: 'unklar', name: 'unklar (bitte klären)' },
  ];

  var PFLEGE = [
    { id: 'gesetzlich', name: 'gesetzlich' },
    { id: 'privat', name: 'privat' },
  ];

  var ARBEITSZEIT = [
    { id: 'vollzeit', name: 'Vollzeit' },
    { id: 'teilzeit', name: 'Teilzeit' },
    { id: 'schicht', name: 'Schicht' },
    { id: 'flexibel', name: 'flexibel' },
  ];

  var JA_NEIN = [
    { id: 'nein', name: 'nein' },
    { id: 'ja', name: 'ja' },
  ];

  var AUFENTHALT = [
    { id: 'irrelevant', name: 'nicht relevant' },
    { id: 'ja', name: 'ja' },
    { id: 'nein', name: 'nein' },
  ];

  var ERLAUBNIS = [
    { id: 'irrelevant', name: 'nicht relevant' },
    { id: 'uneingeschraenkt', name: 'uneingeschränkt' },
    { id: 'eingeschraenkt', name: 'eingeschränkt' },
  ];

  var EINSTELLUNGSUNTERLAGEN = [
    { id: 'ausweis', name: 'Personalausweis oder Reisepass (Kopie)' },
    { id: 'svausweis', name: 'Sozialversicherungsausweis (Kopie)' },
    { id: 'steuerid', name: 'Steuer-ID vorhanden' },
    { id: 'krankenkasse', name: 'Mitgliedsbescheinigung der Krankenkasse' },
    { id: 'aufenthalt', name: 'Aufenthaltstitel / Arbeitserlaubnis (falls relevant)' },
    { id: 'bank', name: 'Nachweis der Bankverbindung (z. B. Bankkarte)' },
    { id: 'quali', name: 'Qualifikations- und Zertifikatskopien' },
  ];

  // ── Unterlagen hochladen ────────────────────────────────────────────────
  var DOKUMENTARTEN = [
    { id: 'zertifikat', name: 'Zertifikat / Schulungsnachweis' },
    { id: 'zeugnis', name: 'Zeugnis / Abschluss' },
    { id: 'lebenslauf', name: 'Lebenslauf' },
    { id: 'ausweis', name: 'Ausweis / Reisepass' },
    { id: 'svausweis', name: 'Sozialversicherungsausweis' },
    { id: 'krankenkasse', name: 'Bescheinigung der Krankenkasse' },
    { id: 'aufenthalt', name: 'Aufenthaltstitel / Arbeitserlaubnis' },
    { id: 'sonstiges', name: 'Sonstiges' },
  ];

  // Vercel nimmt höchstens 4,5 MB je Anfrage an; Base64 macht aus drei
  // Megabyte gut vier. Wer mehr hat, schickt in zwei Durchgängen.
  var UPLOAD = { MAX_BYTES: 3 * 1024 * 1024, MAX_DATEIEN: 10 };

  // ── Erklärungen ─────────────────────────────────────────────────────────
  // Stehen im Formular über der Unterschrift und wandern wortgleich ins PDF,
  // damit der unterschriebene Bogen aus sich heraus belegt, was erklärt wurde.
  var VERANTWORTLICH = 'Verantwortlich ist die Groom&Glow UG (haftungsbeschränkt), ' +
    'Hansaallee 1a, 40549 Düsseldorf, erreichbar unter admin@feminity-oberkassel.de.';

  var ERKLAERUNG_BEWERBUNG = [
    'Ich bestätige, dass die vorstehenden Angaben vollständig und wahrheitsgemäß sind.',
    'Meine Angaben werden ausschließlich zur Durchführung des Bewerbungsverfahrens verarbeitet ' +
      'und nur an die am Auswahlverfahren beteiligten Personen weitergegeben. Rechtsgrundlage ist ' +
      'Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Beschäftigungsverhältnisses).',
    'Kommt keine Einstellung zustande, werden meine Unterlagen sechs Monate nach Abschluss des ' +
      'Verfahrens gelöscht — es sei denn, ich willige unten in eine längere Aufbewahrung ein. ' +
      VERANTWORTLICH,
  ];

  var TALENTPOOL = 'Ich bin einverstanden, dass meine Bewerbung bis zu zwölf Monate aufbewahrt wird, ' +
    'damit Feminity Oberkassel mich bei einer später frei werdenden Stelle ansprechen kann. ' +
    'Freiwillig und jederzeit per E-Mail an admin@feminity-oberkassel.de widerrufbar ' +
    '(Art. 6 Abs. 1 lit. a DSGVO).';

  var ERKLAERUNG_EINSTELLUNG = [
    'Ich bestätige, dass die vorstehenden Angaben vollständig und wahrheitsgemäß sind, und teile ' +
      'Änderungen — etwa von Anschrift, Bankverbindung, Steuerklasse oder Krankenkasse — ' +
      'unaufgefordert mit.',
    'Die Angaben werden zur Durchführung des Arbeitsverhältnisses und für die Lohnabrechnung ' +
      'verarbeitet und dafür an das beauftragte Lohnbüro bzw. die Steuerberatung, die ' +
      'Krankenkasse und die Finanzverwaltung übermittelt. Rechtsgrundlagen sind Art. 6 Abs. 1 ' +
      'lit. b und c DSGVO; die Angabe zur Religionszugehörigkeit wird allein für den ' +
      'Kirchensteuerabzug verarbeitet (Art. 9 Abs. 2 lit. b DSGVO, § 39e EStG).',
    'Die Unterlagen werden nach Ende des Arbeitsverhältnisses gelöscht, sobald die gesetzlichen ' +
      'Aufbewahrungsfristen abgelaufen sind. ' + VERANTWORTLICH,
  ];

  var HINWEIS_UNTERLAGEN = [
    'Die hochgeladenen Dateien gehen per E-Mail an den Salon und werden dort zu Ihrer Bewerbung ' +
      'bzw. Personalakte genommen. Auf dem Server der Website wird nichts gespeichert.',
    'Für Bewerbungsunterlagen gilt dasselbe wie für den Bewerberfragebogen: Löschung sechs Monate ' +
      'nach Abschluss des Verfahrens, wenn keine Einstellung erfolgt. ' + VERANTWORTLICH,
  ];

  // ── Prüfungen ───────────────────────────────────────────────────────────
  // Im Browser, damit ein Tippfehler sofort auffällt, und auf dem Server,
  // damit keine falsche Bankverbindung in der Lohnabrechnung landet.

  function nurZeichen(wert) {
    return String(wert || '').replace(/\s+/g, '').toUpperCase();
  }

  // IBAN nach ISO 13616: Länderkennung nach hinten, Buchstaben zu Zahlen,
  // Rest modulo 97 muss 1 ergeben. Stückweise gerechnet — die Zahl ist zu
  // lang für eine Gleitkommazahl.
  function ibanGueltig(wert) {
    var iban = nurZeichen(wert);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
    if (iban.slice(0, 2) === 'DE' && iban.length !== 22) return false;
    var umgestellt = iban.slice(4) + iban.slice(0, 4);
    var rest = 0;
    for (var i = 0; i < umgestellt.length; i++) {
      var c = umgestellt.charCodeAt(i);
      var ziffern = c >= 65 ? String(c - 55) : umgestellt[i];
      for (var j = 0; j < ziffern.length; j++) rest = (rest * 10 + Number(ziffern[j])) % 97;
    }
    return rest === 1;
  }

  // Steuerliche Identifikationsnummer, § 139b AO: elf Ziffern, die erste
  // nicht 0, Prüfziffer nach ISO 7064 (MOD 11,10).
  function steueridGueltig(wert) {
    var id = String(wert || '').replace(/\D/g, '');
    if (!/^[1-9]\d{10}$/.test(id)) return false;
    var produkt = 10;
    for (var i = 0; i < 10; i++) {
      var summe = (Number(id[i]) + produkt) % 10;
      if (summe === 0) summe = 10;
      produkt = (summe * 2) % 11;
    }
    var pruef = 11 - produkt;
    if (pruef === 10) pruef = 0;
    return pruef === Number(id[10]);
  }

  // Rentenversicherungsnummer: 8 Ziffern, Anfangsbuchstabe des Geburtsnamens,
  // 3 Ziffern. Nur die Form wird geprüft — die Prüfziffer nicht, damit eine
  // korrekte Nummer nie an einer zu strengen Regel scheitert.
  function svnummerGueltig(wert) {
    return /^\d{8}[A-Z]\d{3}$/.test(nurZeichen(wert));
  }

  var PRUEFEN = {
    nurZeichen: nurZeichen, iban: ibanGueltig, steuerid: steueridGueltig, svnummer: svnummerGueltig,
  };

  // Name zu einer id — für Formular und PDF gleichermaßen.
  function name(liste, id) {
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i].name;
    return '';
  }

  var katalog = {
    POSITIONEN: POSITIONEN, MODELLE: MODELLE, ABSCHLUESSE: ABSCHLUESSE, LEVEL: LEVEL,
    SKILLS: SKILLS, AUSSAGEN: AUSSAGEN, TEXTE: TEXTE, BEWERBUNGSUNTERLAGEN: BEWERBUNGSUNTERLAGEN,
    FAMILIENSTAND: FAMILIENSTAND, KONFESSION: KONFESSION, FREIBETRAEGE: FREIBETRAEGE,
    RV_PFLICHT: RV_PFLICHT, PFLEGE: PFLEGE, ARBEITSZEIT: ARBEITSZEIT, JA_NEIN: JA_NEIN,
    AUFENTHALT: AUFENTHALT, ERLAUBNIS: ERLAUBNIS, EINSTELLUNGSUNTERLAGEN: EINSTELLUNGSUNTERLAGEN,
    DOKUMENTARTEN: DOKUMENTARTEN, UPLOAD: UPLOAD,
    ERKLAERUNG_BEWERBUNG: ERKLAERUNG_BEWERBUNG, TALENTPOOL: TALENTPOOL,
    ERKLAERUNG_EINSTELLUNG: ERKLAERUNG_EINSTELLUNG, HINWEIS_UNTERLAGEN: HINWEIS_UNTERLAGEN,
    PRUEFEN: PRUEFEN, name: name,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = katalog;      // Server
  } else {
    global.BEWERBER = katalog;     // Browser
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
