"""Project the committed summit catalog without network access."""
import html
import json


def mountain_layer(data, project):
    catalog = json.loads((data / 'mountains-catalog.json').read_text())
    profiles, markers = [], []
    for mountain in catalog:
        x, y = project(*mountain['coordinates'])
        profiles.append({**mountain, 'anchor': [x, y]})
        name = html.escape(mountain['name'], quote=True)
        markers.append(
            f'<g class="mountain" data-mountain="{mountain["code"]}" '
            f'role="button" tabindex="-1" aria-label="{name}" '
            f'data-anchor-x="{x}" data-anchor-y="{y}" transform="translate({x} {y})">'
            '<circle class="mountain-hit" r="12"/>'
            '<path class="mountain-symbol" d="M0,-6L-5,4L5,4Z"/></g>')
    (data / 'mountains.json').write_text(json.dumps(profiles, ensure_ascii=False, indent=2) + '\n')
    return '<g id="mountainsLayer" hidden="hidden">\n' + '\n'.join(markers) + '\n</g>'
