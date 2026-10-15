from pathlib import Path
from PIL import Image, ImageFilter, ImageChops

pages = Path(r"c:\Users\anmatos\Documents\GitHub\andreiamatos\works\drawings\Linhas\pages")
CREAM = (236, 222, 193)


def cream_paper(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    w, h = img.size
    cream = Image.new("RGB", img.size, CREAM)
    gray = img.convert("L")
    mask = gray.point(lambda p: 0 if p < 188 else min(255, int((p - 188) * 255 / 67)))
    papered = Image.composite(Image.blend(img, cream, 0.48), img, mask)
    noise = Image.effect_noise((max(2, w // 2), max(2, h // 3)), 26).resize(
        (w, h), Image.BILINEAR
    )
    noise = noise.filter(ImageFilter.GaussianBlur(0.55)).convert("RGB")
    grained = Image.blend(papered, ImageChops.multiply(papered, noise), 0.11)
    return Image.composite(grained, papered, mask)


files = sorted(p for p in pages.glob("*.jpg") if p.name[0].isdigit())
print(f"processing {len(files)} pages")
for path in files:
    src = Image.open(path)
    out = cream_paper(src)
    src.close()
    out.save(path, "JPEG", quality=90, optimize=True, progressive=True)
    print(path.name, out.size)
    out.close()

preview = pages / "_preview_cream.jpg"
if preview.exists():
    preview.unlink()
    print("removed preview")
print("done")
