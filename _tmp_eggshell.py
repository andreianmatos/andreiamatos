from pathlib import Path
from PIL import Image, ImageFilter, ImageChops
import pypdfium2 as pdfium

ROOT = Path(r"c:\Users\anmatos\Documents\GitHub\andreiamatos")
PDF = ROOT / "works" / "drawings" / "Linhas" / "linhas.pdf"
OUT = ROOT / "works" / "drawings" / "Linhas" / "pages"
PREVIEW = OUT / "_preview_eggshell.jpg"

# Light warm cream — still yellow, a notch less
EGGSHELL = (247, 235, 204)
BLEND = 0.43
GRAIN = 0.11
TARGET_H = 1600


def paper_grade(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    w, h = img.size
    wash = Image.new("RGB", img.size, EGGSHELL)
    gray = img.convert("L")
    mask = gray.point(lambda p: 0 if p < 188 else min(255, int((p - 188) * 255 / 67)))
    papered = Image.composite(Image.blend(img, wash, BLEND), img, mask)
    noise = Image.effect_noise((max(2, w // 2), max(2, h // 3)), 26).resize(
        (w, h), Image.BILINEAR
    )
    noise = noise.filter(ImageFilter.GaussianBlur(0.55)).convert("RGB")
    grained = Image.blend(papered, ImageChops.multiply(papered, noise), GRAIN)
    return Image.composite(grained, papered, mask)


def render_page(page, scale: float) -> Image.Image:
    return page.render(scale=scale).to_pil()


if __name__ == "__main__":
    import sys

    pdf = pdfium.PdfDocument(str(PDF))
    _, ph = pdf[0].get_size()
    scale = TARGET_H / ph
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"

    if mode == "preview":
        img = paper_grade(render_page(pdf[7], scale))
        img.save(PREVIEW, "JPEG", quality=90, optimize=True)
        print("preview", img.size, PREVIEW)
    else:
        n = len(pdf)
        for i in range(n):
            dest = OUT / f"{i + 1:02d}.jpg"
            img = paper_grade(render_page(pdf[i], scale))
            img.save(dest, "JPEG", quality=90, optimize=True, progressive=True)
            print(dest.name, img.size)
        if PREVIEW.exists():
            PREVIEW.unlink()
        print("done", n)
