"""Fetch local, credited Wikimedia Commons mountain photos (network needed only here)."""

import argparse
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "mountains"
MOUNTAINS = json.loads((ROOT / "assets/data/mountains-catalog.json").read_text())
# English article titles provide reliable photo discovery; German UI names stay unchanged.
TITLES = {
    "mountain-kilimandscharo": "Mount Kilimanjaro", "mountain-mount-kenya": "Mount Kenya",
    "mountain-toubkal": "Toubkal", "mountain-kamerunberg": "Mount Cameroon",
    "mountain-ras-daschaen": "Ras Dashen", "mountain-mount-stanley": "Mount Stanley",
    "mountain-everest": "Mount Everest", "mountain-k2": "K2",
    "mountain-kangchendzoenga": "Kangchenjunga", "mountain-fuji": "Mount Fuji",
    "mountain-ararat": "Mount Ararat", "mountain-damavand": "Mount Damavand",
    "mountain-kinabalu": "Mount Kinabalu", "mountain-semeru": "Semeru",
    "mountain-mont-blanc": "Mont Blanc", "mountain-matterhorn": "Matterhorn",
    "mountain-zugspitze": "Zugspitze", "mountain-grossglockner": "Grossglockner",
    "mountain-triglav": "Triglav", "mountain-olymp": "Mount Olympus",
    "mountain-etna": "Mount Etna", "mountain-ben-nevis": "Ben Nevis",
    "mountain-denali": "Denali", "mountain-mount-logan": "Mount Logan",
    "mountain-mount-rainier": "Mount Rainier", "mountain-mount-whitney": "Mount Whitney",
    "mountain-pico-de-orizaba": "Pico de Orizaba", "mountain-popocatepetl": "Popocatépetl",
    "mountain-aconcagua": "Aconcagua", "mountain-ojos-del-salado": "Ojos del Salado",
    "mountain-chimborazo": "Chimborazo", "mountain-cotopaxi": "Cotopaxi",
    "mountain-huascaran": "Huascarán", "mountain-fitz-roy": "Fitz Roy",
    "mountain-aoraki": "Aoraki / Mount Cook", "mountain-kosciuszko": "Mount Kosciuszko",
    "mountain-mount-wilhelm": "Mount Wilhelm", "mountain-puncak-jaya": "Puncak Jaya",
    "mountain-ruapehu": "Mount Ruapehu", "mountain-taranaki": "Mount Taranaki",
}
# Replace article lead images here if they are not suitable summit photographs.
OVERRIDE_IMAGES = {
    "mountain-ras-daschaen": "Ras Dejen Summit.JPG",  # Summit photograph with complete CC credits.
    "mountain-fitz-roy": "Fitz Roy 1.jpg",  # Clear landscape instead of an archival dedication.
}
ALLOWED_LICENSES = {
    "CC BY 1.0", "CC BY 2.0", "CC BY 2.5", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 4.0",
    "CC BY-SA 2.0 de", "CC BY-SA 2.1 au", "CC BY-SA 3.0 de", "Public domain", "CC0",
}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "WorldQuiz/1.0 (educational project; Wikimedia attribution)"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 503) or attempt == 4:
                raise
            delay = error.headers.get("Retry-After", "")
            time.sleep(min(60, int(delay)) if delay.isdigit() else 5 * (attempt + 1))


def query(host, **params):
    return json.loads(fetch(f"https://{host}/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", **params,
    })))["query"]


def clean(value):
    return " ".join(html.unescape(re.sub(r"<[^>]*>", " ", value or "")).split())


def write_metadata(records):
    (OUT / "metadata.json").write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
    lines = ["# Bildnachweise: Berge", "",
             "Lokal gespeicherte Vorschaubilder aus Wikimedia Commons. Die Fotos wurden ausschließlich skaliert.", ""]
    for item in records:
        license_text = f"[{item['license']}]({item['license_url']})" if item["license_url"] else item["license"]
        lines.append(f"- **{item['name']}** — {item['artist']}; {license_text}; [Originaldatei]({item['page_url']}).")
    (OUT / "ATTRIBUTION.md").write_text("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="refresh photos and credits from Commons")
    parser.add_argument("--list-images", choices=TITLES, help="search Commons photos and credits for choosing an override")
    args = parser.parse_args()
    if args.list_images:
        pages = query("commons.wikimedia.org", generator="search", gsrsearch=TITLES[args.list_images] + " filetype:bitmap",
                      gsrnamespace=6, gsrlimit=8, prop="imageinfo", iiprop="extmetadata")["pages"]
        for page in pages.values():
            if page["title"].lower().endswith((".jpg", ".jpeg")):
                meta = page.get("imageinfo", [{}])[0].get("extmetadata", {})
                print(page["title"], {key: clean(meta.get(key, {}).get("value"))
                      for key in ("LicenseShortName", "LicenseUrl", "Artist", "ImageDescription")}, flush=True)
        return
    OUT.mkdir(parents=True, exist_ok=True)
    metadata = OUT / "metadata.json"
    existing = {r["code"]: r for r in json.loads(metadata.read_text())} if metadata.exists() else {}
    records, failures = [], []
    for mountain in MOUNTAINS:
        code = mountain["code"]
        previous = existing.get(code)
        if (not args.refresh and previous and (ROOT / previous["path"]).exists()
                and previous["file"] == OVERRIDE_IMAGES.get(code, previous["file"])):
            records.append(previous)
            continue
        try:
            filename = OVERRIDE_IMAGES.get(code)
            if not filename:
                result = query("en.wikipedia.org", titles=TITLES[code], prop="pageimages", piprop="name", redirects=1)
                filename = next(iter(result["pages"].values())).get("pageimage")
            if not filename or not filename.lower().endswith((".jpg", ".jpeg")):
                raise ValueError(f"Choose a JPEG photo override: {filename}")
            page = next(iter(query("commons.wikimedia.org", titles="File:" + filename,
                                  prop="imageinfo", iiprop="url|extmetadata", iiurlwidth=320)["pages"].values()))
            info = page.get("imageinfo", [{}])[0]
            meta = info.get("extmetadata", {})
            license_name = clean(meta.get("LicenseShortName", {}).get("value"))
            artist = clean(meta.get("Artist", {}).get("value"))
            license_url = meta.get("LicenseUrl", {}).get("value", "")
            if license_name not in ALLOWED_LICENSES or not artist or not info.get("descriptionurl"):
                raise ValueError(f"Choose a credited, reusable Commons photo: {filename} ({license_name})")
            if license_name != "Public domain" and not license_url:
                raise ValueError(f"Missing license URL: {filename}")
            data = fetch(info["thumburl"])
            if not data.startswith(b"\xff\xd8"):
                raise ValueError(f"Expected JPEG bytes: {filename}")
            path = f"assets/mountains/{code}.jpg"
            (ROOT / path).write_bytes(data)
            records.append({"code": code, "name": mountain["name"], "file": filename,
                            "path": path, "image_url": info["thumburl"], "page_url": info["descriptionurl"],
                            "artist": artist, "license": license_name, "license_url": license_url})
            print(f"{code}: {filename} ({license_name})", flush=True)
            time.sleep(1)
        except (ValueError, KeyError, urllib.error.URLError) as error:
            failures.append(f"{code}: {error}")
            print(failures[-1], flush=True)
            if previous:
                records.append(previous)
        write_metadata(records)
    write_metadata(records)
    if failures:
        raise SystemExit("\n".join(failures))


if __name__ == "__main__":
    main()
