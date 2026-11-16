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
Regierungssitz, Kontinent, ungefähre Fläche, einen kurzen Fakt und einen
deutschen Wikipedia-Link. Über die Region kann die Karte auf einen Kontinent
fokussiert werden. Die übrigen Länder bleiben anklickbar.

**Länder finden** fragt nach der Lage eines Landes. Zur Auswahl stehen 5, 10,
15, 20 oder alle Länder der Region; Standard sind 10. Ziele wiederholen sich
innerhalb einer Runde nicht. Nur die erste gültige Auswahl zählt. Die richtige
Antwort wird grün, eine falsche Auswahl rot markiert und zusätzlich als Text
erklärt. Nach der Antwort öffnen sich die Informationen zum gesuchten Land.
Weitere Klicks erlauben das Erkunden, ohne Punkte zu verändern.

**Weiter** zeigt die nächste Frage. Nach der letzten Antwort beendet
**Ergebnis ansehen** die Runde. Das Ergebnis enthält die Fehlerübersicht;
**Fehler wiederholen** übt nur diese Ziele, auch wenn nur ein Fehler vorliegt.
Weitere Übungsrunden enthalten nur die verbliebenen Fehler. **Neu starten**
startet die aktuelle Runde neu (bei Übungen mit ihrem vollständigen Fragensatz).
**Neue Runde** verwendet wieder den normalen Fragenpool.

Ein Regionswechsel oder eine Änderung der Fragenanzahl beendet eine laufende
Runde. Ein Wechsel zu einem anderen Modus beendet sie ebenfalls. Das bloße
Öffnen oder Schließen der Modusauswahl sowie die Auswahl des aktuellen Modus
behalten den Spielstand. Runden und Fehler werden nur im Arbeitsspeicher
gehalten; ein Neuladen beginnt von vorn.

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
Bildaufrufe. Eine installierbare Offline-App/PWA ist in dieser Version nicht enthalten.

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

## Statisch veröffentlichen

Den gesamten Inhalt von `dist/` auf einem statischen HTTP(S)-Host bereitstellen,
beispielsweise GitHub Pages. Domainwurzel und Unterverzeichnisse wie
`/WorldQuiz/` werden unterstützt; Unterverzeichnisse mit abschließendem Slash
ausliefern. JavaScript als JavaScript und SVG als `image/svg+xml` ausliefern.
Ein Backend, Benutzerkonto oder API-Schlüssel ist nicht erforderlich.

## Tests

`npm test` prüft Ländervollständigkeit und lokale Flaggen, Kartenreferenzen,
Marker und Antimeridian-Geometrie, Fragenpools, Wertung, Fehlerübungen sowie
Zoomgrenzen und Gestenerkennung. Für einen Browser-Smoke-Test nach dem Build
siehe `scripts/browser-smoke.mjs`.

Der Anwendungscode steht unter GPL-3.0-or-later. Drittdaten besitzen die in
den Quellenhinweisen angegebenen Lizenzen.
