"""Generate quiz river profiles and SVG from committed Natural Earth features."""
import html
import json
import math


def southern_segments(line, latitude=-27.30):
    """Keep the lower Paraná, excluding the mislabeled Paraguay upstream."""
    result, part = [], []
    for a, b in zip(line, line[1:]):
        inside_a, inside_b = a[1] <= latitude, b[1] <= latitude
        if inside_a and not part:
            part.append(a)
        if inside_a != inside_b:
            t = (latitude - a[1]) / (b[1] - a[1])
            crossing = [a[0] + t * (b[0] - a[0]), latitude]
            if inside_a:
                part.append(crossing)
                result.append(part)
                part = []
            else:
                part = [crossing, b]
        elif inside_b:
            part.append(b)
    if len(part) > 1:
        result.append(part)
    return result


def river_layer(data, project):
    catalog = json.loads((data / 'rivers-catalog.json').read_text())
    snapshot = json.loads((data / 'rivers-source.geojson').read_text())
    features = {f['id']: f for f in snapshot['features']}
    profiles, groups = [], []
    for river in catalog:
        lines = []
        for identifier in river['sourceFeatureIds']:
            feature = features[identifier]
            geometry = feature['geometry']
            source_lines = geometry['coordinates'] if geometry['type'] == 'MultiLineString' else [geometry['coordinates']]
            for line in source_lines:
                if river['code'] == 'river-parana' and feature['properties']['rivernum'] == 36:
                    pieces = southern_segments(line)
                else:
                    pieces = [line]
                for piece in pieces:
                    points = []
                    for lon, lat, *_ in piece:
                        point = project(lon, lat)
                        if not points or point != points[-1]:
                            points.append(point)
                    if len(points) > 1:
                        lines.append(points)
        assert lines, f'Missing geometry: {river["code"]}'
        points = [p for line in lines for p in line]
        left, top = [min(p[k] for p in points) for k in (0, 1)]
        right, bottom = [max(p[k] for p in points) for k in (0, 1)]
        # An actual course vertex nearest the visual center is useful even
        # for rivers with disconnected lake-centerline segments.
        anchor = min(points, key=lambda p: math.dist(p, [(left + right) / 2, (top + bottom) / 2]))
        profiles.append({**river, 'sourceUrls': [*river['sourceUrls'], snapshot['sourceUrl']],
                         'anchor': anchor, 'bounds': {'x': left, 'y': top, 'width': right - left, 'height': bottom - top}})
        path = ''.join('M' + 'L'.join(f'{x},{y}' for x, y in line) for line in lines)
        name = html.escape(river['name'], quote=True)
        groups.append(f'<g class="river" data-river="{river["code"]}" role="button" tabindex="-1" aria-label="{name}" data-anchor-x="{anchor[0]}" data-anchor-y="{anchor[1]}">'
                      f'<path class="river-line" d="{path}"/><path class="river-hit" d="{path}"/></g>')
    (data / 'rivers.json').write_text(json.dumps(profiles, ensure_ascii=False, indent=2) + '\n')
    return '<g id="riversLayer" hidden="hidden">\n' + '\n'.join(groups) + '\n</g>'
