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

## Fehler korrigieren

**Fehler korrigieren** speichert falsch beantwortete Fragen aus **Länder finden**,
**Hauptstädte zuordnen** und ihren Fehlerübungen sofort in diesem Browser. Die
Themenkarte zeigt die Anzahl offener Fragen. Länder- und Hauptstadtfragen zum
selben Land zählen getrennt. Der Modus wird über die Modusauswahl aktiviert;
**Fehler wiederholen** übt weiterhin nur die Fehler der letzten Runde.

Jede gespeicherte Frage muss in zwei aufeinanderfolgenden Runden richtig
beantwortet werden. Auch normale Quizrunden und Fehlerübungen zählen. Eine
falsche Antwort setzt den Fortschritt zurück. Nach einer richtigen Antwort
erscheint **1 von 2 richtig**, nach der zweiten **Fehler korrigiert!**.

Eine Korrekturrunde mischt weltweit bis zu zehn unterschiedliche gespeicherte
Fragen aus beiden Themen. Fragen ohne richtige Antwort haben bei der Auswahl
Vorrang; innerhalb der Gruppen und im gewählten Fragensatz ist die Reihenfolge
zufällig. Region und Fragenanzahl sind in diesem Modus ausgeblendet.
**Neue Übungsrunde** und **Übung neu starten** wählen aus den aktuell offenen
Fragen neu aus. Ohne offene Fragen ist der Start deaktiviert. Diese Übungen
erhalten keine Rekordwertung. Das Ergebnis zeigt die in der Runde korrigierten
und die insgesamt noch offenen Fragen. Auch nach einer fehlerfreien Runde können
noch Fragen offen sein.

Antworten werden sofort gespeichert: Abbrechen, Moduswechsel und Neuladen
behalten den Fortschritt. Die Speicherung benötigt weder Konto noch Server.
Falls Browser-Speicher ausfällt, bleiben Fehler für die Sitzung erhalten; ein
Hinweis erscheint in den Einstellungen. Das Löschen der Browserdaten entfernt
sie. Das Zurücksetzen von Rekorden hat keinen Einfluss auf gespeicherte Fehler.
Fehler aus Sitzungen vor Einführung dieser Funktion können nicht übernommen werden.

## Persönliche Rekorde

**Länder finden** und **Hauptstädte zuordnen** speichern persönliche Rekorde
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
Darstellung des Heiligen Stuhls. Andere Gebiete dienen als nicht gewerteter
Kartenkontext. Die Kontinentzuordnung ist eine feste Lernzuordnung, beschrieben
in [Daten und Quellen](ATTRIBUTION.md).

Die Karte verwendet Natural Earth 1:50m in Equal-Earth-Projektion. Flaggen und
Länderdaten sind lokal gebündelt. Beim Spielen gibt es keine externen API- oder
Bildaufrufe. Die gebaute Version ist als App installierbar und nach dem ersten vollständigen Download offline nutzbar.

Ausgangsdaten stehen unter `assets/data/`. `scripts/generate-data.py` enthält
deutsche Namens- und Hauptstadtanpassungen, Fakten und die Kartenprojektion.
Nach Änderungen erzeugt `npm run data:generate` die Profile und das SVG neu,
ohne Netzwerkzugriff oder zusätzliche Python-Pakete. Neue Flaggen können
explizit mit `python3 scripts/download-flags.py` heruntergeladen werden;
vorhandene Dateien werden übersprungen. Der normale Build lädt nichts herunter.

Der Metadatensnapshot stammt aus mledoze/countries (ODbL), anstelle der im
ursprünglichen Entwurf vorgesehenen Wikidata-Abfrage. Die abgeleitete Datenbank
und die Lizenz werden mit ausgeliefert. Quellen, Abrufdatum und Lizenzhinweise
stehen in [ATTRIBUTION.md](ATTRIBUTION.md).
Die Einwohnerzahlen stammen aus dem gebündelten Natural-Earth-Snapshot
(Schätzungen von 2019–2020) und werden nicht laufend aktualisiert.

## Als App installieren und offline spielen

Die gebaute Version in `dist/` ist eine Progressive Web App (PWA). Auf Android
WorldQuiz in Chrome öffnen und **App installieren** wählen, sobald der Knopf
angeboten wird. Alternativ im Browsermenü **App installieren** oder **Zum
Startbildschirm hinzufügen** wählen; auf iPhone und iPad in Safari das Teilen-Menü
und **Zum Home-Bildschirm** verwenden. Die genaue Installation hängt vom Browser
ab. Das WorldQuiz-Symbol öffnet die App in einem eigenen Fenster.

Beim ersten Onlinebesuch lädt der Service Worker das gesamte veröffentlichte
Paket herunter: Karte, alle Flaggen, Spieldateien, Quelldaten und Lizenznachweise
(etwa 9,2 MB zuzüglich App-Symbolen). Erst **Offline verfügbar** bestätigt den
abgeschlossenen Download. Danach funktionieren alle vier Modi und auch bisher
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

## Tests

`npm test` prüft Ländervollständigkeit und lokale Flaggen, Kartenreferenzen,
Marker und Antimeridian-Geometrie, Fragenpools, Wertung, Fehlerübungen sowie
Zoomgrenzen und Gestenerkennung. Die PWA-Tests prüfen Manifest, PNG-Abmessungen,
vollständigen Offlinecache, Build-Versionen, Installationssteuerung, Statusanzeigen,
fehlgeschlagene Downloads und die Cache-Isolation bei Root- und Unterverzeichnis-Hosting.
Für einen Browser-Smoke-Test nach dem Build siehe `scripts/browser-smoke.mjs`.
Mit derselben dort beschriebenen Chromium-Instanz prüft
`node scripts/browser-pwa-smoke.mjs` zusätzlich Manifest, Offline-Neustart,
unbesuchte Flaggen, alle vier Modi und den Update-Lebenszyklus unter `/` und
`/WorldQuiz/`. Der PWA-Test startet einen temporären lokalen HTTP-Server und
benötigt keinen bereits laufenden App-Server; `dist/` bleibt unverändert.

Der Anwendungscode steht unter GPL-3.0-or-later. Drittdaten besitzen die in
den Quellenhinweisen angegebenen Lizenzen.
