#!/usr/bin/env python3
"""Generate German profiles and an Equal Earth SVG from the committed snapshots.

No network or third-party Python packages required. Edit overrides here, then
run npm run data:generate. Natural Earth 1:50m supplies simplified geometry.
"""
import html
import json
import math
from pathlib import Path
from urllib.parse import quote
from river_data import river_layer
from mountain_data import mountain_layer

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets/data'
CAPITALS = {
    'AM': ['Jerewan'], 'AT': ['Wien'], 'BE': ['Brüssel'], 'BN': ['Bandar Seri Begawan'],
    'CN': ['Peking'], 'CY': ['Nikosia'], 'CZ': ['Prag'], 'DJ': ['Dschibuti'],
    'DK': ['Kopenhagen'], 'DZ': ['Algier'], 'EG': ['Kairo'], 'ET': ['Addis Abeba'],
    'GR': ['Athen'], 'GT': ['Guatemala-Stadt'], 'IR': ['Teheran'], 'IT': ['Rom'],
    'KG': ['Bischkek'], 'KH': ['Phnom Penh'], 'KI': ['Süd-Tarawa'], 'KP': ['Pjöngjang'],
    'LK': ['Sri Jayewardenepura Kotte'], 'LU': ['Luxemburg'], 'MC': ['Monaco'],
    'MN': ['Ulaanbaatar'], 'MX': ['Mexiko-Stadt'], 'MZ': ['Maputo'], 'NR': ['Yaren (Regierungssitz)'],
    'PS': ['Ostjerusalem (beansprucht)', 'Ramallah (Verwaltungssitz)'], 'RO': ['Bukarest'],
    'RS': ['Belgrad'], 'RU': ['Moskau'], 'SA': ['Riad'], 'SM': ['San Marino'],
    'SY': ['Damaskus'], 'TD': ['N’Djamena'], 'TJ': ['Duschanbe'], 'TN': ['Tunis'],
    'UA': ['Kyjiw'], 'US': ['Washington, D.C.'], 'UZ': ['Taschkent'], 'VA': ['Vatikanstadt'],
    'VN': ['Hanoi'], 'YE': ['Sanaa'], 'ZA': ['Pretoria', 'Kapstadt', 'Bloemfontein'],
    'SZ': ['Mbabane (Verwaltung)', 'Lobamba (Parlament und Königssitz)'],
    'BO': ['Sucre (Hauptstadt)', 'La Paz (Regierungssitz)'],
    'EH': ['El Aaiún (beansprucht)'], 'TW': ['Taipeh'], 'XK': ['Pristina'],
    'CH': ['Bern (Bundesstadt)'], 'IL': ['Jerusalem (Status international umstritten)'],
}
NAMES = {'VA': 'Vatikanstadt', 'PS': 'Palästina', 'CZ': 'Tschechien', 'SZ': 'Eswatini', 'CV': 'Kap Verde', 'TL': 'Osttimor'}
WIKI = {'CD': 'Demokratische Republik Kongo', 'CG': 'Republik Kongo', 'GE': 'Georgien', 'FM': 'Föderierte Staaten von Mikronesien', 'VA': 'Vatikanstadt'}
FACTS = {
    'XK': 'Kosovo erklärte 2008 seine Unabhängigkeit; seine staatliche Anerkennung ist international umstritten.',
    'TW': 'Taiwan besitzt eine eigene Regierung; sein politischer Status ist international umstritten.',
    'EH': 'Westsahara wird von den Vereinten Nationen als Gebiet ohne Selbstregierung geführt; sein endgültiger Status ist ungeklärt.',
    'DE': 'Deutschland besteht aus 16 Bundesländern.',
    'FR': 'Zu Frankreich gehören auch Gebiete außerhalb Europas, etwa Französisch-Guayana.',
    'AU': 'Das Great Barrier Reef liegt vor der Nordostküste Australiens.',
    'BR': 'Ein großer Teil des Amazonas-Regenwaldes liegt in Brasilien.',
    'CA': 'Kanada grenzt an den Atlantischen, Pazifischen und Arktischen Ozean.',
    'CN': 'Die Große Mauer besteht aus zahlreichen, zu unterschiedlichen Zeiten errichteten Abschnitten.',
    'EG': 'Der Nil durchquert Ägypten von Süden nach Norden.',
    'GR': 'Zu Griechenland gehören zahlreiche Inseln im Mittelmeer.',
    'IN': 'Der Himalaya bildet einen Teil der nördlichen Landschaft Indiens.',
    'ID': 'Indonesien erstreckt sich über Tausende Inseln beiderseits des Äquators.',
    'IS': 'Island liegt auf dem Mittelatlantischen Rücken und ist vulkanisch aktiv.',
    'IT': 'Die Halbinsel Italiens wird oft mit der Form eines Stiefels verglichen.',
    'JP': 'Hokkaidō, Honshū, Shikoku und Kyūshū sind die vier größten Inseln Japans.',
    'KE': 'Der Äquator verläuft durch Kenia.',
    'MX': 'Mexiko liegt zwischen dem Pazifik und dem Golf von Mexiko.',
    'NL': 'Amsterdam ist die Hauptstadt; die Regierung hat ihren Sitz in Den Haag.',
    'NP': 'Der Mount Everest liegt an der Grenze zwischen Nepal und China.',
    'NZ': 'Die Nordinsel und die Südinsel sind die beiden größten Inseln Neuseelands.',
    'PA': 'Der Panamakanal verbindet den Atlantischen mit dem Pazifischen Ozean.',
    'PE': 'Die Inka-Stätte Machu Picchu liegt in den peruanischen Anden.',
    'RU': 'Russland erstreckt sich über Europa und Asien; hier ist es Europa zugeordnet.',
    'TR': 'Die Türkei liegt in Asien und Europa; hier ist sie Asien zugeordnet.',
    'US': 'Die Vereinigten Staaten bestehen aus 50 Bundesstaaten.',
    'VA': 'Vatikanstadt ist flächenmäßig der kleinste Staat der Welt und liegt innerhalb Roms.',
    'PS': 'Palästina hat bei den Vereinten Nationen den Status eines Beobachterstaates.',
    'ZA': 'Die Aufgaben der Hauptstadt sind auf Pretoria, Kapstadt und Bloemfontein verteilt.',
    'CH': 'Die Schweiz hat vier Landessprachen: Deutsch, Französisch, Italienisch und Rätoromanisch.',
    'AR': 'Die Anden bilden einen großen Teil der Grenze zu Chile.',
    'CL': 'Chile erstreckt sich als langes, schmales Land entlang der Westküste Südamerikas.',
    'NO': 'Die norwegische Küste ist von zahlreichen Fjorden geprägt.',
    'FI': 'Finnland besitzt zahlreiche Seen und große Waldflächen.',
    'MA': 'Das Atlasgebirge erstreckt sich durch Marokko.',
    'MG': 'Viele Tier- und Pflanzenarten Madagaskars kommen nur dort vor.',
    'FJ': 'Fidschi liegt nahe der Datumsgrenze im südlichen Pazifik.',
    'KI': 'Die Inseln Kiribatis liegen beiderseits des Äquators und des 180. Längengrades.',
    'NR': 'Nauru hat keine offizielle Hauptstadt; der Regierungssitz liegt im Distrikt Yaren.',
    'LK': 'Sri Jayewardenepura Kotte ist die Hauptstadt; Colombo ist ein wichtiges Verwaltungszentrum.',
    'SG': 'Singapur ist ein Stadtstaat an der Südspitze der Malaiischen Halbinsel.',
    'LS': 'Lesotho ist vollständig von Südafrika umgeben.',
    'SM': 'San Marino ist vollständig von Italien umgeben.',
    'MN': 'Die Wüste Gobi erstreckt sich über Teile der Mongolei und Chinas.',
}

def project(lon, lat):
    # Equal Earth, Šavrič et al. 2018, with north at the top.
    a1, a2, a3, a4 = 1.340264, -0.081106, 0.000893, 0.003796
    theta = math.asin(math.sqrt(3) / 2 * math.sin(math.radians(lat)))
    t2, t6 = theta * theta, theta ** 6
    x = 2 * math.sqrt(3) * math.radians(lon) * math.cos(theta) / (3 * (a1 + 3 * a2 * t2 + t6 * (7 * a3 + 9 * a4 * t2)))
    y = theta * (a1 + a2 * t2 + t6 * (a3 + a4 * t2))
    return [round(600 + x * 215, 2), round(292 - y * 215, 2)]

def continent(c):
    if c['cca2'] == 'RU':
        return 'Europa'
    if c['region'] == 'Americas':
        return 'Südamerika' if c['subregion'] == 'South America' else 'Nordamerika'
    return {'Africa': 'Afrika', 'Asia': 'Asien', 'Europe': 'Europa', 'Oceania': 'Ozeanien'}[c['region']]

def main():
    original = json.loads((DATA / 'countries-source.json').read_text())
    countries = [c for c in original if c['unMember'] or c['cca2'] in ('VA', 'PS', 'XK', 'TW', 'EH')]
    assert len(countries) == 198
    features = json.loads((DATA / 'world-source.geojson').read_text())['features']
    population_by3 = {f['properties']['ADM0_A3']: f['properties'] for f in features}
    by3 = {c['cca3']: c['cca2'].lower() for c in countries}
    by2 = {c['cca2']: c['cca2'].lower() for c in countries}
    by_feature = {}
    for feature in features:
        p = feature['properties']
        code = by2.get(p['ISO_A2_EH']) or by3.get(p['ADM0_A3'])
        if code:
            by_feature[code] = feature

    profiles = []
    for c in countries:
        code = c['cca2'].lower()
        name = NAMES.get(c['cca2'], c['translations']['deu']['common'])
        f = by_feature.get(code)
        population_source = population_by3.get(c['cca3'], f['properties'])
        if c['cca2'] == 'RU':
            anchor = project(37.62, 55.75)  # European heartland rather than Siberia.
        elif f and c['area'] > 12000:
            anchor = project(f['properties']['LABEL_X'], f['properties']['LABEL_Y'])
        else:
            anchor = project(c['latlng'][1], c['latlng'][0])
        fact = FACTS.get(c['cca2'])
        if not fact:
            if c['landlocked']:
                fact = f'{name} ist ein Binnenstaat und hat keinen direkten Zugang zum offenen Meer.'
            elif not c['borders']:
                fact = f'{name} ist ein Inselstaat ohne Landgrenzen zu anderen Staaten.'
            else:
                fact = f'{name} liegt in {continent(c)} und besitzt sowohl eine Meeresküste als auch Landgrenzen.'
        profiles.append({
            'code': code, 'name': name, 'capitals': CAPITALS.get(c['cca2'], c['capital']),
            'continent': continent(c), 'areaKm2': c['area'], 'fact': fact,
            'population': round(population_source['POP_EST']),
            'populationYear': population_source['POP_YEAR'],
            'flag': f'assets/flags/{code}.svg',
            'wikipediaUrl': 'https://de.wikipedia.org/wiki/' + quote(WIKI.get(c['cca2'], name).replace(' ', '_')),
            'anchor': anchor, 'marker': c['area'] < 12000 or not f or (not c['borders'] and c['area'] < 40000),
            'sourceUrls': ['https://github.com/mledoze/countries', 'https://www.naturalearthdata.com/'],
        })
    profiles.sort(key=lambda c: c['name'])
    (DATA / 'countries.json').write_text(json.dumps(profiles, ensure_ascii=False, indent=2) + '\n')
    profiles_by_code = {c['code']: c for c in profiles}
    paths = []
    for feature in features:
        p, geom = feature['properties'], feature['geometry']
        code = by2.get(p['ISO_A2_EH']) or by3.get(p['ADM0_A3'])
        polygons = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        commands = []
        for polygon in polygons:
            for ring in polygon:
                points = [project(*xy[:2]) for xy in ring]
                # Input geometry is already split at the antimeridian.
                commands.append('M' + 'L'.join(f'{x},{y}' for x, y in points) + 'Z')
        d = ''.join(commands)
        # Units outside the selected profiles remain non-selectable context.
        if code:
            name = html.escape(profiles_by_code[code]['name'], quote=True)
            attrs = f'class="country" data-country="{code}" role="button" tabindex="0" aria-label="{name}"'
        else:
            disputed = p.get('BRK_DIFF') == 1 or p.get('ADM0_A3') in ('TWN', 'KOS', 'SAH', 'SOL', 'CYN')
            attrs = f'class="context{" disputed" if disputed else ""}" aria-hidden="true"'
        paths.append(f'<path {attrs} d="{d}"/>')
    markers = []
    for c in profiles:
        if not c['marker']:
            continue
        x, y = c['anchor']
        markers.append(f'<g class="country marker" data-country="{c["code"]}" role="button" tabindex="0" aria-label="{html.escape(c["name"], quote=True)}" transform="translate({x} {y})"><circle class="marker-hit" r="10"/><circle class="marker-dot" r="3.5"/></g>')
    svg = '<svg id="worldMap" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 590" role="group" aria-label="Interaktive Weltkarte">\n'
    svg += '<g fill-rule="evenodd">' + '\n'.join(paths) + '</g>\n' + '\n'.join(markers) + '\n' + river_layer(DATA, project) + '\n' + mountain_layer(DATA, project) + '\n</svg>\n'
    (ROOT / 'src/world.svg').write_text(svg)
    print(f'Generated {len(profiles)} profiles, {len(paths)} map features, {len(markers)} small-country markers.')

if __name__ == '__main__':
    main()
