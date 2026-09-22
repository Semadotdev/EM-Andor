#!/usr/bin/env python3
"""Generate PWA icons from src/assets/logo.png into public/icons/."""
from pathlib import Path

from PIL import Image

BRAND_GREEN = (0, 107, 60, 255)  # #006B3C
ROOT = Path(__file__).resolve().parents[1]


def export(logo, size, path, pad_ratio):
    canvas = Image.new("RGBA", (size, size), BRAND_GREEN)
    inner = round(size * pad_ratio)
    scaled = logo.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - inner) // 2, (size - inner) // 2))
    canvas.convert("RGB").save(path, "PNG")
    print(f"wrote {path} ({size}x{size}, logo at {pad_ratio:.0%})")


def main():
    logo = Image.open(ROOT / "src/assets/logo.png").convert("RGBA")
    out = ROOT / "public/icons"
    out.mkdir(parents=True, exist_ok=True)

    for size in (192, 512):
        export(logo, size, out / f"pwa-{size}.png", 0.85)
    for size in (192, 512):
        export(logo, size, out / f"pwa-maskable-{size}.png", 0.55)
    export(logo, 180, out / "apple-touch-icon.png", 0.85)


if __name__ == "__main__":
    main()
