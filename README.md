# WorldQuiz

Ein deutschsprachiges Lernspiel über die Länder der Welt. Gestaltung und
Kartenbedienung orientieren sich am BayernQuiz desselben Autors.

## Lokal starten

Node.js 24 oder neuer und Python 3 werden benötigt. Keine npm-Abhängigkeiten.

```sh
npm test
npm run build
npm run serve:dist
```

Danach `http://localhost:8000/` öffnen. Nicht direkt als `file://` öffnen:
Die Anwendung lädt ihre lokalen Daten über HTTP.

## Lernen und spielen

**Lernen** ist standardmäßig ausgewählt. Ein Klick auf ein Land oder einen
kleinen Länderpunkt öffnet Flagge, deutschen Namen, Hauptstadt beziehungsweise
Regierungssitz, Kontinent, ungefähre Fläche, geschätzte Einwohnerzahl mit Bezugsjahr, einen kurzen Fakt und einen
deutschen Wikipedia-Link. Über die Region kann die Karte auf einen Kontinent
fokussiert werden. Die übrigen Länder bleiben anklickbar.
Auf Smartphones und Tablets werden die Länderinformationen unterhalb der Karte
angezeigt und automatisch in den sichtbaren Bereich gescrollt. Im Quiz bleibt die
Frage angeheftet; **Weiter** bringt die nächste Frage und die Karte wieder ins Bild.

**Länder finden** fragt nach der Lage eines Landes. Zur Auswahl stehen 5, 10,
15, 20 oder alle Länder der Region; Standard sind 10. Ziele wiederholen sich
innerhalb einer Runde nicht. Nur die erste gültige Auswahl zählt. Die richtige
Antwort wird grün, eine falsche Auswahl rot markiert und zusätzlich als Text
erklärt. Nach der Antwort öffnen sich die Informationen zum gesuchten Land.
Weitere Klicks erlauben das Erkunden, ohne Punkte zu verändern.

**Hauptstädte zuordnen** nennt eine Hauptstadt beziehungsweise einen Regierungssitz.
Wähle das zugehörige Land auf der Karte. Bei mehreren hinterlegten Hauptstädten
oder Sitzen werden alle Namen mit ihren Zusatzangaben gemeinsam angezeigt.
Regionen, Fragenanzahl, Wertung und Fehlerübungen funktionieren wie bei
**Länder finden**. Rückmeldungen und Fehlerübersicht enthalten auch die Hauptstädte.

**Flaggenquiz** zeigt eine Flagge. Wähle das zugehörige Land auf der Karte.
Regionen, Fragenanzahl, Wertung, persönliche Rekorde und Fehlerübungen funktionieren
wie bei **Länder finden**. Die Auflösung nennt das gesuchte Land; die Fehlerübersicht
zeigt zusätzlich die Flagge.

**Einwohnerzahl** nennt ein Land und das Bezugsjahr der Schätzung. Wähle aus vier
gerundeten Zahlen die ungefähre Einwohnerzahl. Die Zahlen sind auf zwei
signifikante Stellen gerundet und deutlich voneinander getrennt. Verwendet werden
die gebündelten historischen Schätzungen von 2017–2020. Vor der Antwort öffnen
Kartenklicks keine Länderprofile; danach kannst du die Karte wieder erkunden.
Regionen, Fragenanzahl, persönliche Rekorde und Fehlerübungen funktionieren wie
bei den anderen Quizthemen.

**Flüsse finden** fragt „Wo fließt …?“. Wähle den gesuchten blauen Flusslauf
auf der Karte. Enthalten sind 38 bekannte Flüsse aus allen sechs Regionen.
Vor dem Start, nach einer Antwort und nach der Runde lassen sich Name,
ungefähre Länge und ein Wikipedia-Link erkunden. Der richtige Verlauf wird grün,
eine falsche Auswahl rot markiert; die erste gültige Auswahl zählt.
Bei überlappenden Auswahlbereichen wird der nächstgelegene Flusslauf gewählt.
Länder dienen in diesem Modus als Orientierung. In **Lernen** bleiben Flüsse ausgeblendet.

Regionen, automatische Fortsetzung, Rekorde und Fehlerübungen funktionieren
wie bei **Länder finden**. Zur Auswahl stehen 5, 10, 15, 20 oder alle Flüsse der
Region, soweit der Pool groß genug ist. Ozeanien enthält vier Flüsse und wird
mit allen vier gespielt. Benannte Nebenflüsse wie Missouri und Darling sind
eigene Ziele. Die Karte zeigt vereinfachte Verläufe; die Längen stammen aus den
verlinkten Quellen und wurden nicht aus der Karte berechnet.

**Berge finden** fragt „Wo liegt …?“. Wähle den gesuchten Gipfel an seiner
dreieckigen Markierung auf der Karte. Enthalten sind 40 bekannte Berge aus allen
sechs Regionen. Vor dem Start, nach einer Antwort und nach der Runde kannst du
Name, ungefähre Höhe und einen Wikipedia-Link erkunden. Ländernamen und Flüsse
sind in diesem Modus keine Antworten. Die erste gültige Auswahl zählt; richtige
und falsche Antworten werden grün beziehungsweise rot markiert.

Bei nah beieinanderliegenden Gipfeln hilft der Zoom. Die Markierungen behalten
ihre Bildschirmgröße; bei überlappenden Auswahlbereichen wird der nächstgelegene
Gipfel gewählt. Alle Berge sind außerdem per Tab und Enter / Leertaste erreichbar.
Regionen, Fragenanzahl, automatische Fortsetzung, Rekorde und Fehlerübungen
funktionieren wie bei **Flüsse finden**. Höhen werden als Näherungswerte angezeigt
und nicht abgefragt. In **Lernen** bleiben Berge ausgeblendet.

**Gemischtes Quiz** kombiniert Länder, Hauptstädte, Flaggen, Einwohnerzahlen,
Flüsse und Berge. Die Themen werden möglichst gleichmäßig verteilt: Zehn Fragen enthalten
eine oder zwei Fragen pro Thema; zwölf Fragen enthalten zwei pro Thema. Jedes Land kommt pro Runde nur einmal vor,
auch über verschiedene Themen hinweg; jeder Fluss und jeder Berg ebenfalls. Bei kleinen Pools
werden fehlende Plätze auf die übrigen Themen verteilt. **Alle** umfasst jedes
Land, jeden Fluss und jeden Berg der gewählten Region einmal. Region, Fragenanzahl,
automatische Fortsetzung und persönliche Rekorde funktionieren wie gewohnt.
Fehler werden unter dem jeweiligen Thema gespeichert; **Fehler wiederholen**
behält Thema und Ziel der verfehlten Fragen bei und erhält keine Rekordwertung.

**Weiter** zeigt die nächste Frage. Nach der letzten Antwort beendet
**Ergebnis ansehen** die Runde. Das Ergebnis enthält die Fehlerübersicht;
**Fehler wiederholen** übt nur diese Ziele, auch wenn nur ein Fehler vorliegt.
Weitere Übungsrunden enthalten nur die verbliebenen Fehler. **Neu starten**
startet die aktuelle Runde neu (bei Übungen mit ihrem vollständigen Fragensatz).
**Neue Runde** verwendet wieder den normalen Fragenpool.

Ein Regionswechsel oder eine Änderung der Fragenanzahl beendet eine laufende
Runde. Ein Wechsel zu einem anderen Modus beendet sie ebenfalls. Das bloße
Öffnen oder Schließen der Modusauswahl sowie die Auswahl des aktuellen Modus
behalten den Spielstand. Laufende Runden bleiben nur im Arbeitsspeicher; ein
Neuladen beginnt von vorn. Gespeicherte Fehler bleiben erhalten.

## Fehler & Wiederholen

**Fehler & Wiederholen** speichert falsch beantwortete Fragen aus **Länder finden**,
**Hauptstädte zuordnen**, **Flaggenquiz**, **Einwohnerzahl**, **Flüsse finden**, **Berge finden**, **Gemischtes Quiz** und ihren Fehlerübungen sofort in diesem Browser. Die
Themenkarte zeigt offene Fehler und fällige Wiederholungen getrennt. Länder-, Hauptstadt-, Flaggen- und Einwohnerfragen zum
selben Land zählen getrennt. Fluss- und Bergfragen werden pro Fluss beziehungsweise Berg gespeichert. Der Modus wird über die Modusauswahl aktiviert;
**Fehler wiederholen** übt weiterhin nur die Fehler der letzten Runde.

Jede gespeicherte Frage muss zweimal hintereinander richtig beantwortet werden.
Auch normale Quizrunden und Fehlerübungen zählen. Nach der ersten richtigen Antwort
erscheint **1 von 2 richtig**. Nach der zweiten bleibt die Frage für zeitversetzte
Wiederholungen gespeichert: nach **1, 3, 7, 14, 30, 30 und 30 Tagen**.
Nach sieben erfolgreichen fälligen Wiederholungen, darunter drei nach jeweils
30 Tagen, wird sie aus der Wiederholungsliste entfernt. Bei pünktlichem Üben sind
das 115 Tage nach der Korrektur. Die Lernstatistik bleibt erhalten. Ein späterer
Fehler nimmt die Frage erneut auf.

Eine falsche Antwort setzt jederzeit die Korrektur und die gesamte Terminfolge
zurück. Eine richtige Antwort vor dem Termin zählt in der Lernstatistik, verschiebt
aber keinen Termin. Auch fällige Antworten in normalen Quizrunden zählen als
Wiederholung. Ein Tag entspricht 24 Stunden; der nächste Termin wird ab der
tatsächlichen richtigen Antwort berechnet, auch bei verspäteten Wiederholungen.
Die Geräteuhr bestimmt die Fälligkeit. Es gibt keine Benachrichtigungen.

Eine Übungsrunde mischt weltweit bis zu zehn unterschiedliche Fragen aus allen
sechs Quizthemen. Offene Fehler ohne richtige Antwort haben Vorrang, danach folgen
Fehler mit einer richtigen Antwort und anschließend die ältesten fälligen
Wiederholungen. Gleichstände und die Reihenfolge im ausgewählten Fragensatz sind
zufällig. Region und Fragenanzahl sind in diesem Modus ausgeblendet.
**Neue Übungsrunde** und **Übung neu starten** wählen aus den aktuell verfügbaren
Fragen neu aus. Während einer Runde kommen keine neuen Fragen hinzu.

Themenkarte und Einstellungen zeigen offene Fehler und fällige Wiederholungen
getrennt. Ohne verfügbare Fragen ist der Start deaktiviert und der nächste Termin
wird angezeigt. Die Verfügbarkeit wird beim Öffnen, bei Rückkehr zum Tab und jede
Minute im sichtbaren Tab aktualisiert. Diese Übungen erhalten keine Rekordwertung.
Das Ergebnis zeigt korrigierte Fragen, erfolgreiche Wiederholungen und davon
abgeschlossene Fragen sowie verbleibende Fehler und fällige Wiederholungen.
Auch nach einer fehlerfreien Runde können weitere Fragen oder Termine verbleiben.

Bestehende gespeicherte Fehler werden mit ihrem Korrekturfortschritt übernommen.
Früher bereits gelöschte Fehler lassen sich nicht nachträglich übernehmen.

Antworten werden sofort gespeichert: Abbrechen, Moduswechsel und Neuladen
behalten den Fortschritt. Die Speicherung benötigt weder Konto noch Server.
Falls Browser-Speicher ausfällt, bleiben Fehler für die Sitzung erhalten; ein
Hinweis erscheint in den Einstellungen. Das Löschen der Browserdaten entfernt
sie. Das Zurücksetzen von Rekorden hat keinen Einfluss auf gespeicherte Fehler.
Fehler aus Sitzungen vor Einführung dieser Funktion können nicht übernommen werden.

## Lernfortschritt

**Lernfortschritt** öffnet eine Übersicht, ohne die aktuelle Runde zu verlassen.
Thema und Region lassen sich unabhängig von den Quizeinstellungen filtern.
Die Übersicht zeigt richtige Antworten insgesamt und in den letzten 100 Antworten,
die Anzahl normaler und Übungsantworten sowie die Abdeckung nach Thema und Kontinent.
Abdeckung zählt unterschiedliche ausprobierte Fragen, nicht beherrschte Inhalte:
Land, Hauptstadt, Flagge und Einwohnerzahl desselben Landes zählen jeweils einzeln.
Die Kontinentzuordnung folgt dem Ziel der Frage, auch in weltweiten und gemischten Runden.

Jede erste gültige Antwort zählt sofort, einschließlich Fehlerübungen und später
abgebrochener Runden. Weitere Kartenklicks zählen nicht. Ein Neustart erzeugt neue
Versuche; bisherige Antworten bleiben erfasst. Die Rundenliste zeigt bis zu 20
passende abgeschlossene Runden aus den letzten 100, mit Datum, Region und Ergebnis.
Gemischte Runden und Korrekturübungen erscheinen unter ihren enthaltenen Themen,
zeigen aber das gesamte Rundenergebnis. Der Regionsfilter bezieht sich bei Runden
auf die gewählte Rundenregion. Eine Runde ist erst nach **Ergebnis ansehen** abgeschlossen.

**Offene Fehler** zeigt den Korrekturfortschritt; **Geplante Wiederholungen** zeigt
Termine, Fälligkeit und die Anzahl bereits geschaffter Wiederholungen. Beide Listen
folgen den Themen- und Regionsfiltern.
**Fehler & Wiederholen** wählt unabhängig von diesen Filtern den weltweiten Übungsmodus aus; die Übung wird dort
gestartet. Während einer laufenden Runde ist dieser Wechsel deaktiviert.
Das Öffnen des Dialogs stoppt automatisches Weitergehen; nach dem Schließen geht
es mit **Weiter** manuell weiter. Für spätere Antworten bleibt die gewählte Automatik aktiv.

Die Erfassung beginnt mit Einführung der Funktion; ältere Rekorde enthalten keine
Antwortstatistik und werden nicht übernommen. Fortschritt bleibt ausschließlich in
diesem Browser und funktioniert offline. Bei Speicherfehlern bleibt er für die Sitzung
erhalten; der Dialog zeigt einen Hinweis. Das Löschen der Browserdaten entfernt ihn.
Das Zurücksetzen von Rekorden und das Korrigieren von Fehlern löschen keine Lernstatistik.

## Persönliche Rekorde

**Länder finden**, **Hauptstädte zuordnen**, **Flaggenquiz**, **Einwohnerzahl**, **Flüsse finden**, **Berge finden** und **Gemischtes Quiz** speichern persönliche Rekorde
getrennt nach Modus, Region und Fragenanzahl. Die Themenkarten und Einstellungen
zeigen **Dein Rekord** für die aktuelle Auswahl. Das Ergebnis meldet einen ersten,
verbesserten oder eingestellten Rekord. Nur richtige Antworten zählen; es gibt
keine Zeitwertung. Erst das Weitergehen nach der letzten Antwort beendet und
wertet die Runde, auch bei automatischem Weitergehen. Lernen, abgebrochene und
neu gestartete Runden sowie Fehlerübungen erhalten keine Rekordwertung.

Rekorde bleiben ausschließlich in diesem Browser gespeichert, ohne Konto oder
Übertragung an einen Server. Das Löschen der Browserdaten entfernt sie. Ist
Browser-Speicher nicht verfügbar, bleiben Rekorde für die aktuelle Sitzung
erhalten; ein Hinweis erscheint in den Einstellungen.

**Rekorde zurücksetzen…** bietet nach einer Bestätigung den Rekord der aktuellen
Auswahl oder alle Rekorde zum Löschen an. Während einer laufenden Runde ist das
Zurücksetzen nicht verfügbar. **Abbrechen** oder Escape schließt den Dialog ohne
Änderungen. Andere Einstellungen bleiben erhalten; das Löschen kann nicht
rückgängig gemacht werden. Scheitert das Speichern der Löschung, bleiben die
Rekorde erhalten und der Dialog zeigt einen Hinweis.

## Kartenbedienung

- Maus: Mausrad oder **+ / −** zum Zoomen (100–3200 %); Ziehen zum Verschieben.
- Touch: Zwei Finger zoomen; bei vergrößerter Karte verschiebt ein Finger.
  Bei 100 % scrollt ein Finger die Seite.
- Tastatur: Karte per Tab fokussieren, **+ / −**, Pfeiltasten und **Pos1**
  verwenden. Länder mit Tab und **Enter / Leertaste** auswählen.
- **Zurücksetzen** zeigt die ganze Welt. Der Ausschnitt bleibt zwischen
  Fragen erhalten; Rundenstart und Regionswechsel fokussieren die gewählte Region.
- Kleine Länder und Inselstaaten sind zusätzlich über Punkte auswählbar.
  Bei dicht benachbarten Punkten hilft der Zoom.

## Daten und Aktualisierung

Enthalten sind 193 UN-Mitglieder sowie Palästina und Vatikanstadt als geografische
Darstellung des Heiligen Stuhls. Hinzu kommen Kosovo, Taiwan und Westsahara:
Insgesamt sind 198 Länder und Gebiete im Lernen und in den vier Länderquizmodi auswählbar. Das Flussquiz besitzt einen eigenen Pool mit 38 Flüssen, das Bergquiz einen mit 40 Gipfeln.
Weitere Gebiete dienen als nicht gewerteter Kartenkontext.
Die Kontinentzuordnung ist eine feste Lernzuordnung, beschrieben
in [Daten und Quellen](ATTRIBUTION.md).

Die Karte verwendet Natural Earth 1:50m in Equal-Earth-Projektion. Flaggen und
Länderdaten sowie kleine Fotos aller 40 Berge sind lokal gebündelt. Die Fotos erscheinen
in den Berginformationen beim Erkunden und nach einer Quizantwort. Beim Spielen gibt es keine externen API- oder
Bildaufrufe. Die gebaute Version ist als App installierbar und nach dem ersten vollständigen Download offline nutzbar.

Ausgangsdaten stehen unter `assets/data/`. `scripts/generate-data.py` enthält
deutsche Namens- und Hauptstadtanpassungen, Fakten und die Kartenprojektion.
Nach Änderungen erzeugt `npm run data:generate` die Profile und das SVG einschließlich der Flussprofile, Flussläufe und Bergmarkierungen neu,
ohne Netzwerkzugriff oder zusätzliche Python-Pakete. Neue Flaggen können
explizit mit `python3 scripts/download-flags.py` heruntergeladen werden;
vorhandene Dateien werden übersprungen. Der normale Build lädt nichts herunter.
Bergfotos und Bildnachweise werden mit `python3 scripts/fetch-mountain-images.py`
heruntergeladen; `--refresh` erneuert vorhandene Dateien. Die zugehörigen Lizenzen
stehen in [Bildnachweise: Berge](assets/mountains/ATTRIBUTION.md).

Der Metadatensnapshot stammt aus mledoze/countries (ODbL), anstelle der im
ursprünglichen Entwurf vorgesehenen Wikidata-Abfrage. Die abgeleitete Datenbank
und die Lizenz werden mit ausgeliefert. Quellen, Abrufdatum und Lizenzhinweise
stehen in [ATTRIBUTION.md](ATTRIBUTION.md).
Die Einwohnerzahlen stammen aus dem gebündelten Natural-Earth-Snapshot
(Schätzungen von 2017–2020) und werden nicht laufend aktualisiert.

## Als App installieren und offline spielen

Die gebaute Version in `dist/` ist eine Progressive Web App (PWA). Auf Android
WorldQuiz in Chrome öffnen und **App installieren** wählen, sobald der Knopf
angeboten wird. Alternativ im Browsermenü **App installieren** oder **Zum
Startbildschirm hinzufügen** wählen; auf iPhone und iPad in Safari das Teilen-Menü
und **Zum Home-Bildschirm** verwenden. Die genaue Installation hängt vom Browser
ab. Das WorldQuiz-Symbol öffnet die App in einem eigenen Fenster.

Beim ersten Onlinebesuch lädt der Service Worker das gesamte veröffentlichte
Paket herunter: Karte, alle Flaggen, Spieldateien, Quelldaten und Lizenznachweise
(etwa 11 MB einschließlich App-Symbolen). Erst **Offline verfügbar** bestätigt den
abgeschlossenen Download. Danach funktionieren alle neun Modi und auch bisher
ungeöffnete Länderprofile ohne Verbindung. Externe Wikipedia- und Quellenlinks
benötigen weiterhin Internet. **Offline noch nicht verfügbar** bedeutet, dass der
Download noch läuft, fehlgeschlagen ist oder der Browser die Offlinefunktion
nicht unterstützt. Bei einer späteren Onlineöffnung wird die Installation erneut
versucht. Browser können gespeicherte Dateien bei Speicherknappheit oder beim
Löschen von Websitedaten entfernen.

Updates werden beim Onlineöffnen im Hintergrund vollständig heruntergeladen.
Sie werden aktiv, sobald alle offenen WorldQuiz-Fenster und -Tabs geschlossen
sind. Eine laufende Runde wird nicht neu geladen. Rekorde und gespeicherte Fehler
bleiben unter ihren bisherigen Browser-Speicherschlüsseln erhalten; laufende
Runden werden nicht gespeichert. Browserdaten sind an Browser und Hosting-Origin
gebunden und werden bei einem Domainwechsel nicht automatisch übernommen.

Zum Prüfen `npm run build` und `npm run serve:dist` ausführen. Auf
`http://localhost:8000/` ist der Service Worker auch ohne HTTPS erlaubt. In den
Chromium-Entwicklerwerkzeugen unter **Application** Manifest, Service Worker und
Cache Storage prüfen. Nach **Offline verfügbar** im Network-Panel **Offline**
aktivieren und die Seite neu laden; alle Modi und bisher ungeöffnete Flaggen
müssen funktionieren. Auf Android zusätzlich nach der Installation im Flugmodus
über das App-Symbol starten. Eine unverschlüsselte LAN-IP ersetzt beim Testen auf
dem Telefon kein HTTPS. Direktes Öffnen per `file://` oder das Ausliefern von
`src/` unterstützt die Offlineinstallation nicht.

Die PNG-App-Symbole sind vom vorhandenen `src/globe.svg` abgeleitet; die
maskierbare Variante hat einen deckenden Hintergrund und zusätzlichen Innenabstand.
Die Symbole sind eingecheckt; der normale Build benötigt keine Grafikwerkzeuge.

## Statisch veröffentlichen

Den gesamten Inhalt von `dist/` auf einem statischen HTTPS-Host bereitstellen,
beispielsweise GitHub Pages. Domainwurzel und Unterverzeichnisse wie
`/WorldQuiz/` werden unterstützt; Unterverzeichnisse mit abschließendem Slash
ausliefern. `manifest.webmanifest` als `application/manifest+json`, JavaScript
(einschließlich `sw.js`) mit JavaScript-MIME-Typ und SVG als `image/svg+xml`
ausliefern. Für `sw.js` und `index.html` `Cache-Control: no-cache` setzen; für die
übrigen unversionierten Dateinamen keine dauerhaft unveränderlichen HTTP-Caches
verwenden. Neue Builds vollständig und möglichst atomar bereitstellen, damit
die Offlineinstallation keine Dateien verschiedener Versionen mischt.
Ein Backend, Benutzerkonto oder API-Schlüssel ist nicht erforderlich.

Für GitHub Pages unter **Settings → Pages → Source** die Option
**GitHub Actions** auswählen. Der Workflow `.github/workflows/pages.yml`
baut und veröffentlicht die App bei jedem Push auf `main`. Er kann auch
manuell über **Actions → Deploy to GitHub Pages → Run workflow** gestartet werden.
Build und Upload laufen in einem eigenen Job vor der Veröffentlichung. Bei einem
vorübergehenden Deploymentfehler kann nur der fehlgeschlagene Deploymentjob erneut
gestartet werden; er verwendet den ursprünglichen Artefaktnamen. Ist das Artefakt
bereits abgelaufen, einen neuen Workflow über **Run workflow** starten.

## Tests

`npm test` prüft Ländervollständigkeit und lokale Flaggen, Kartenreferenzen,
Marker und Antimeridian-Geometrie, Fluss- und Bergprofile und Quellzuordnung, reproduzierbare
Datengenerierung, Fragenpools, Wertung, Fehlerübungen sowie
Zoomgrenzen und Gestenerkennung. Lernfortschritt-Tests prüfen Antwortzählung,
Themen- und Regionsfilter, Abdeckung, begrenzte Verlaufsspeicherung und Speicherfehler.
Die PWA-Tests prüfen Manifest, PNG-Abmessungen,
vollständigen Offlinecache, Build-Versionen, Installationssteuerung, Statusanzeigen,
fehlgeschlagene Downloads und die Cache-Isolation bei Root- und Unterverzeichnis-Hosting.
Für einen Browser-Smoke-Test nach dem Build siehe `scripts/browser-smoke.mjs`.
Der Browser-Smoke-Test prüft auch Bergfragen, Tastaturauswahl, Maus und Touch sowie gemischte Runden mit sechs Themen.
Die Wiederholungstests prüfen Migration, Fälligkeit, sieben Intervalle, Abschluss und
erneute Aufnahme nach Fehlern. Nur die Browser-Prüfungen für Wiederholungen starten:
`node scripts/browser-smoke.mjs http://localhost:8000/ http://127.0.0.1:9223 --reviews-only`.
Für Lernfortschritt prüft er leere und gefüllte Ansichten, Filter, Rundenergebnisse,
Übungsantworten, Neuladen, die mobile Darstellung sowie das Pausieren der Automatik.
Nur das Flussquiz prüfen: `node scripts/browser-smoke.mjs http://localhost:8000/ http://127.0.0.1:9223 --rivers-only`.
Mit derselben dort beschriebenen Chromium-Instanz prüft
`node scripts/browser-pwa-smoke.mjs` zusätzlich Manifest, Offline-Neustart,
unbesuchte Flaggen, alle neun Modi, Lernfortschritt nach Offline-Neuladen und den Update-Lebenszyklus unter `/` und
`/WorldQuiz/`. Der PWA-Test startet einen temporären lokalen HTTP-Server und
benötigt keinen bereits laufenden App-Server; `dist/` bleibt unverändert.

Der Anwendungscode steht unter GPL-3.0-or-later. Drittdaten besitzen die in
den Quellenhinweisen angegebenen Lizenzen.
