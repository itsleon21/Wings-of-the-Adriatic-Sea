"""Pack CC0 Poly Haven scans into two mip-friendly terrain atlases.

Run with Python + Pillow. Sources are cached in /tmp/adriatic-surface-scans;
only the derived atlases are shipped. Each 512px cell has a wrapped 16px
gutter. RGB is de-lit albedo; data RG=OpenGL normal XY, B=roughness, A=height.
"""
import concurrent.futures
import json
from pathlib import Path
import urllib.request
from PIL import Image, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('/tmp/adriatic-surface-scans')
OUT = ROOT / 'public/textures/terrain'
ASSETS = ['rock_2', 'grass_path_2', 'coast_sand_05', 'rocky_terrain']
CACHE.mkdir(exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)


def fetch(url, target):
    if not target.exists():
        req = urllib.request.Request(url, headers={'User-Agent': 'AdriaticSurfaceBuild/1.0'})
        target.write_bytes(urllib.request.urlopen(req, timeout=90).read())
    return target


def load_asset(asset):
    meta = json.loads(fetch(f'https://api.polyhaven.com/files/{asset}', CACHE / f'{asset}.json').read_text())
    images = {}
    for key in ['Diffuse', 'nor_gl', 'Rough', 'Displacement']:
        file = meta[key]['1k']['jpg']
        path = fetch(file['url'], CACHE / f'{asset}-{key}.jpg')
        images[key] = Image.open(path).convert('RGB').resize((480, 480), Image.Resampling.LANCZOS)
    return images


def wrapped_cell(image):
    # 480 content pixels surrounded by matching opposite edges; mipmaps never
    # leak a neighboring biome into another tile's useful UV rectangle.
    tile = Image.new(image.mode, (512, 512))
    for dy in [-480, 0, 480]:
        for dx in [-480, 0, 480]:
            tile.paste(image, (16 + dx, 16 + dy))
    return tile


albedo, data = Image.new('RGB', (1024, 1024)), Image.new('RGBA', (1024, 1024))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    scans = list(pool.map(load_asset, ASSETS))
for i, scan in enumerate(scans):
    color = scan['Diffuse']
    # Remove scan illumination at scales >~1/8 tile. World-space biome colors
    # supply the large-scale palette, while the scanned pores and stones remain.
    blur = color.filter(ImageFilter.GaussianBlur(40))
    neutral = Image.new('RGB', color.size, (128, 128, 128))
    detail = ImageChops.add(ImageChops.subtract(color, blur, scale=1, offset=128), neutral, scale=2)
    nx, ny, _ = scan['nor_gl'].split()
    packed = Image.merge('RGBA', (nx, ny, scan['Rough'].convert('L'), scan['Displacement'].convert('L')))
    p = ((i % 2) * 512, (i // 2) * 512)
    albedo.paste(wrapped_cell(detail), p)
    data.paste(wrapped_cell(packed), p)
albedo.save(OUT / 'coast-albedo.jpg', quality=91, subsampling=0, optimize=True)
data.save(OUT / 'coast-normal-rh.png', optimize=True)
print('Wrote', [(p.name, p.stat().st_size) for p in OUT.iterdir()])
