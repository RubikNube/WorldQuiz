#!/usr/bin/env python3
"""Download the selected countries' SVG flags. Run explicitly; builds use local assets."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
import json
import time

ROOT = Path(__file__).resolve().parents[1]

def download(country):
    code = country['cca2'].lower()
    path = ROOT / 'assets' / 'flags' / f'{code}.svg'
    if path.exists():
        return
    for attempt in range(3):
        try:
            request = Request(f'https://flagcdn.com/{code}.svg', headers={'User-Agent': 'WorldQuiz/1.0 (local educational assets)'})
            with urlopen(request, timeout=30) as response:
                data = response.read()
            if b'<svg' not in data or b'<script' in data:
                raise ValueError(f'Invalid SVG for {code}')
            path.write_bytes(data)
            return
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)

if __name__ == '__main__':
    data = json.loads((ROOT / 'assets/data/countries-source.json').read_text())
    countries = [c for c in data if c['unMember'] or c['cca2'] in ('VA', 'PS', 'XK', 'TW', 'EH')]
    with ThreadPoolExecutor(max_workers=6) as executor:
        list(executor.map(download, countries))
    print(f'{len(countries)} local flags ready.')
