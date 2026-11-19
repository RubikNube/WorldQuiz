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
Änderungen: Auswahl der 198 Quizziele, deutsche Namen und Hauptstadtangaben,
Kontinentzuordnung, Kartenanker und kurze deutsche Informationstexte.
Die Lizenz der Datenbank ist unabhängig von der GPL-Lizenz des Anwendungscodes.

Die Auswahl umfasst die [193 UN-Mitglieder](https://www.un.org/en/about-us/member-states)
und die [Beobachterstaaten Heiliger Stuhl und Palästina](https://www.un.org/en/about-us/non-member-states).
Der Heilige Stuhl wird auf der Karte durch Vatikanstadt dargestellt.
Zusätzlich sind Kosovo, Taiwan und Westsahara auswählbar (insgesamt 198 Ziele).
Die Statushinweise orientieren sich an den Angaben zur
[Anerkennung Kosovos](https://www.bundestag.de/resource/blob/959762/WD-2-038-23-pdf.pdf),
zur [Taiwan-Frage](https://www.auswaertiges-amt.de/de/newsroom/2545960-2545960)
und zum [UN-Status Westsaharas](https://www.un.org/dppa/decolonization/en/nsgt/western-sahara).
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
`POP_YEAR` dieses Snapshots. Es sind gerundete Schätzungen von 2017–2020;
das jeweilige Bezugsjahr wird neben der Einwohnerzahl angezeigt.

Die Karte folgt den [De-facto-Grenzen von Natural Earth](https://www.naturalearthdata.com/about/disputed-boundaries-policy/).
Diese Darstellung ist keine Aussage über die völkerrechtliche Anerkennung.
Separate umstrittene Kontextgebiete sind gestrichelt dargestellt. Kosovo, Taiwan
und Westsahara besitzen auswählbare Profile mit Hinweisen zu ihrem Status.
Abhängige Gebiete und die Antarktis bleiben Kartenkontext. Kleine Staaten
und Inselgruppen besitzen zusätzliche Auswahlpunkte. Kartenumrisse sind
generalisiert und nicht zur Navigation geeignet.

## Flüsse (Public Domain und Längenangaben)

38 ausgewählte Flüsse aus [Natural Earth, Rivers + lake centerlines, 1:10m](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/),
abgerufen am 19. November 2026 aus
[natural-earth-vector](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_rivers_lake_centerlines.geojson).
Natural-Earth-Geometrien sind Public Domain. Der ausgewählte Ausgangssnapshot
steht unverändert auf Feature-Ebene in `assets/data/rivers-source.geojson`;
`id` ist der nullbasierte Feature-Index des Downloads. Download-URL, Datum und
SHA-256 des vollständigen Downloads stehen im Snapshot. Die ursprünglichen
`rivernum`- und `dissolve`-Kennungen bleiben erhalten.

`assets/data/rivers-catalog.json` ordnet die Originalfeatures den Quizflüssen zu.
Der gleichnamige australische Mackenzie ist ausgeschlossen. Beim Paraná wird
der im Ausgangsdatensatz ebenfalls als Paraná bezeichnete Paraguay-Oberlauf
(Feature mit `rivernum` 36) nördlich von 27,30° Süd abgeschnitten; der untere
Paraná bleibt erhalten. Oberlaufnamen des Kongo (Lualaba), Jangtsekiang (Jinsha,
Tongtian; der Mittellauf heißt im Datensatz Chang Jiang), Jenissei (Verkhniy Yenisey) und Dnepr (Dnepre) sind demselben Quizziel
zugeordnet. Mississippi und Missouri sowie Murray und Darling bleiben getrennte
Ziele; Nebenflüsse werden nicht zu gemeinsamen Antwortzielen verbunden.

Die Datengenerierung projiziert die Verläufe in dieselbe Equal-Earth-Projektion
wie die Länderkarte und ergänzt einen Anker direkt auf dem jeweiligen Verlauf.
Die Karte ist generalisiert; Seen, Deltas und Oberläufe können unvollständig sein.
Flüsse über Ländergrenzen hinweg bleiben ein Ziel. Die Lernzuordnung lautet:
Afrika (6), Asien (8, einschließlich der sibirischen Flüsse), Europa (8),
Nordamerika (6), Südamerika (6), Ozeanien (4, einschließlich Sepik).

Die ungefähren Längen sind einzeln zusammengestellte Zahlenangaben aus den
jeweils in `sourceUrls` verlinkten deutschsprachigen Wikipedia-Artikeln,
Stand 19. November 2026. Es wurden keine Artikeltexte übernommen. Die Werte
stehen im Katalog und werden unverändert in `assets/data/rivers.json` ausgegeben.
Sie sind keine Messung der Kartenlinien und keine Rangliste. Messwege und
Quellflussdefinitionen unterscheiden sich; Nil und Amazonas enthalten die
üblichen Quellflussstrecken, worauf ihre Profile hinweisen. Insbesondere werden
Mississippi und Missouri sowie Murray und Darling mit ihren eigenen Längen
angegeben, nicht mit der Gesamtlänge des jeweils längsten Flusssystems.

## Berge

40 einzeln zusammengestellte Gipfel in `assets/data/mountains-catalog.json`,
Stand 19. November 2026. Koordinaten (Längengrad, Breitengrad) und ungefähre
Höhen wurden mit den jeweils in `sourceUrls` verlinkten deutschsprachigen
Wikipedia-Artikeln abgeglichen; für Toubkal und Mount Stanley wurden die
englischsprachigen Artikel verwendet. Es wurden nur einzelne Zahlenangaben
und Namen übernommen, keine Artikeltexte oder Bilder. Die Zusammenstellung
steht wie der Anwendungscode unter GPL-3.0-or-later; Quellenangaben bleiben
im ausgelieferten Katalog und in den generierten Profilen erhalten.

Die Höhen sind auf ganze Meter gerundete Näherungswerte. Mount Everest nutzt
8849 m (gerundet aus der gemeinsamen chinesisch-nepalesischen Messung von
2020: 8848,86 m). Mont Blanc nutzt den im verlinkten Artikel angegebenen
Snapshot von 4807,3 m, gerundet auf 4807 m; Schnee- und Eishöhen verändern
sich. Für Ätna sind 3403 m hinterlegt; vulkanische Gipfelhöhen verändern sich
ebenfalls. Kilimandscharo bezeichnet den höchsten Gipfel Kibo, Mount Kenya den
Batian, Mount Stanley die Margherita-Spitze, Olymp den Mytikas und Huascarán
den Südgipfel. Die Karte zeigt jeweils einen Gipfelpunkt, keinen Gebirgsumriss.

Die feste Lernzuordnung lautet Afrika (6), Asien (8), Europa (8), Nordamerika
(6), Südamerika (6), Ozeanien (6). Puncak Jaya auf Neuguinea gehört geografisch
zu Ozeanien, obwohl Indonesien im Länderquiz Asien zugeordnet ist. Ararat
gehört zu Asien. Grenzgipfel werden nur einmal geführt. Diese Auswahl ist
keine Rangliste der höchsten Berge.

`scripts/mountain_data.py` projiziert die Koordinaten mit derselben
Equal-Earth-Projektion wie die Länderkarte und erzeugt `assets/data/mountains.json`
sowie die Bergmarkierungen in `src/world.svg`. Der normale Build und die
Datengenerierung benötigen keinen Netzwerkzugriff.

## Flaggen

Lokale SVG-Dateien von [Flagpedia / Flagcdn](https://flagpedia.net/download),
abgerufen am 16. November 2026; Kosovo, Taiwan und Westsahara ergänzt am
17. November 2026. Flagpedia stellt diese Flaggendarstellungen
als frei nutzbare Public-Domain-Dateien bereit. Die Dateien wurden unverändert
über `https://flagcdn.com/{iso-alpha-2}.svg` heruntergeladen.

Die Anwendung ruft beim Spielen keine externen Daten- oder Bilddienste auf.
Nur bewusst geöffnete Quellen- und Wikipedia-Links benötigen Internetzugriff.
