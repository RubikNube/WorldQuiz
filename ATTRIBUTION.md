# WorldQuiz – Daten und Quellen

## Anwendung

WorldQuiz steht unter GPL-3.0-or-later, siehe [LICENSE](LICENSE).
Gestaltung und Kartenbedienung wurden aus dem vom selben Autor erstellten
BayernQuiz übernommen und für die Weltkarte angepasst. Das Globussymbol ist
eine originale SVG-Zeichnung dieses Projekts.

## Länderdaten (ODbL)

Die Datenbank basiert auf [mledoze/countries](https://github.com/mledoze/countries),
abgerufen am 16. November 2026. Sie steht unter der
[Open Database License (ODbL)](assets/data/ODbL.txt).
Die angepasste Datenbank wird ebenfalls unter ODbL bereitgestellt:
[countries.json](assets/data/countries.json). Der unveränderte Ausgangssnapshot
ist als [countries-source.json](assets/data/countries-source.json) enthalten.
Änderungen: Auswahl der 195 Quizziele, deutsche Namen und Hauptstadtangaben,
Kontinentzuordnung, Kartenanker und kurze deutsche Informationstexte.
Die Lizenz der Datenbank ist unabhängig von der GPL-Lizenz des Anwendungscodes.

Die Auswahl umfasst die [193 UN-Mitglieder](https://www.un.org/en/about-us/member-states)
und die [Beobachterstaaten Heiliger Stuhl und Palästina](https://www.un.org/en/about-us/non-member-states).
Der Heilige Stuhl wird auf der Karte durch Vatikanstadt dargestellt.
Kapitalangaben können mehrere Funktionen unterscheiden. Flächen sind ungefähre
Werte aus dem Snapshot und keine fortlaufend aktualisierten Messungen.
Wikipedia-Links dienen zum Weiterlesen; es werden keine Artikeltexte kopiert.

Primäre Kontinente: Amerika ist in Nordamerika (einschließlich Mittelamerika
und Karibik) und Südamerika unterteilt. Russland ist Europa zugeordnet;
Türkei, Zypern, Armenien, Aserbaidschan, Georgien und Kasachstan Asien.
Weitere Staatsgebiete außerhalb des Hauptkontinents ändern die Zuordnung nicht.

## Karte (Public Domain)

[Natural Earth](https://www.naturalearthdata.com/), Admin 0 Countries, 1:50m,
abgerufen am 16. November 2026 aus
[natural-earth-vector](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson).
[Nutzungsbedingungen: Public Domain](https://www.naturalearthdata.com/about/terms-of-use/).
Der Ausgangssnapshot ist als `assets/data/world-source.geojson` enthalten.
Darstellung in Equal-Earth-Projektion (Šavrič, Patterson und Jenny, 2018).
Die Einwohnerzahlen der Länderprofile verwenden die Felder `POP_EST` und
`POP_YEAR` dieses Snapshots. Es sind gerundete Schätzungen von 2019–2020;
das jeweilige Bezugsjahr wird neben der Einwohnerzahl angezeigt.

Die Karte folgt den [De-facto-Grenzen von Natural Earth](https://www.naturalearthdata.com/about/disputed-boundaries-policy/).
Diese Darstellung ist keine Aussage über die völkerrechtliche Anerkennung.
Separate umstrittene Kontextgebiete sind gestrichelt dargestellt. Taiwan,
Kosovo, abhängige Gebiete und die Antarktis sind keine Quizziele. Kleine Staaten
und Inselgruppen besitzen zusätzliche Auswahlpunkte. Kartenumrisse sind
generalisiert und nicht zur Navigation geeignet.

## Flaggen

Lokale SVG-Dateien von [Flagpedia / Flagcdn](https://flagpedia.net/download),
abgerufen am 16. November 2026. Flagpedia stellt diese Flaggendarstellungen
als frei nutzbare Public-Domain-Dateien bereit. Die Dateien wurden unverändert
über `https://flagcdn.com/{iso-alpha-2}.svg` heruntergeladen.

Die Anwendung ruft beim Spielen keine externen Daten- oder Bilddienste auf.
Nur bewusst geöffnete Quellen- und Wikipedia-Links benötigen Internetzugriff.
