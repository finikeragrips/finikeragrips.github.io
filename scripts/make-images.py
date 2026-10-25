"""Generate optimized WebP copies of assets/*.jpg for the site:
   assets/w640/<name>.webp  (cards, thumbnails, gallery)
   assets/w1080/<name>.webp (hero, product view, lightbox)
   assets/favicon.png, assets/apple-touch-icon.png (from logo.png)
Run after adding photos:  python3 scripts/make-images.py   (needs Pillow)"""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent / 'assets'
for width in (640, 1080):
    out = root / f'w{width}'
    out.mkdir(exist_ok=True)
    for src in sorted(root.glob('*.jpg')):
        dst = out / (src.stem + '.webp')
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            continue
        im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=80, method=6)

logo = Image.open(root / 'logo.png').convert('RGBA')
for name, size in (('favicon.png', 64), ('apple-touch-icon.png', 180)):
    logo.resize((size, round(logo.height * size / logo.width)), Image.LANCZOS).save(root / name, optimize=True)
print('ok')
