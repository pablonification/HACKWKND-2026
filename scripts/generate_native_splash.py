from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets"
PLAYFAIR_ITALIC_FONT = ASSETS_DIR / "fonts" / "PlayfairDisplay-Italic-Variable.ttf"

BG = "#FFF9E9"
WORDMARK = "#060606"

IOS_TARGETS = [
    ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset" / "splash-2732x2732.png",
    ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset" / "splash-2732x2732-1.png",
    ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset" / "splash-2732x2732-2.png",
]

ANDROID_TARGETS = {
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable" / "splash.png": (480, 320),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-port-mdpi" / "splash.png": (320, 480),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-port-hdpi" / "splash.png": (480, 800),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-port-xhdpi" / "splash.png": (720, 1280),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-port-xxhdpi" / "splash.png": (960, 1600),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-port-xxxhdpi" / "splash.png": (1280, 1920),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-land-mdpi" / "splash.png": (480, 320),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-land-hdpi" / "splash.png": (800, 480),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-land-xhdpi" / "splash.png": (1280, 720),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-land-xxhdpi" / "splash.png": (1600, 960),
    ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-land-xxxhdpi" / "splash.png": (1920, 1280),
}


def font(path: Path, size: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), round(size))


def measure_text(text: str, font_obj: ImageFont.FreeTypeFont) -> tuple[int, int]:
    left, top, right, bottom = font_obj.getbbox(text)
    return right - left, bottom - top


def render_text_image(
    text: str,
    font_obj: ImageFont.FreeTypeFont,
    color: str,
    tracking: int = 0,
) -> Image.Image:
    width, height = measure_text(text, font_obj)
    pad = max(24, int(font_obj.size * 0.4))
    base = Image.new("RGBA", (width + pad * 4, height + pad * 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    x = pad
    y = pad
    for char in text:
        char_w, _ = measure_text(char, font_obj)
        draw.text((x, y), char, font=font_obj, fill=color)
        x += char_w + tracking

    return base.crop(base.getbbox())


def paste_with_alpha(base: Image.Image, overlay: Image.Image, xy: tuple[int, int]) -> None:
    base.alpha_composite(overlay, dest=xy)


def draw_wordmark(base: Image.Image, center_x: float, center_y: float, scale: float) -> float:
    # Adjusted spacing for the new web layout to match exactly
    wordmark_width = int(225.713 * scale)
    wordmark_height = int(106.523 * scale)
    
    # Position everything around the visual center
    origin_x = int(center_x - wordmark_width / 2)
    origin_y = int(center_y - wordmark_height / 2)
    
    initial = render_text_image(
        "T",
        font(PLAYFAIR_ITALIC_FONT, 113.373 * scale),
        WORDMARK,
        tracking=0,
    )
    rest = render_text_image(
        "aleka",
        font(PLAYFAIR_ITALIC_FONT, 64.198 * scale),
        WORDMARK,
        tracking=0,
    )
    
    paste_with_alpha(base, initial, (origin_x, int(origin_y - 1 * scale)))
    
    # Tuck "aleka" under "T" exactly like the CSS
    # CSS does: font size 64px, margin-left: -24px, but baseline aligned.
    # In canvas we have absolute coords
    paste_with_alpha(base, rest, (origin_x + int(50 * scale), int(origin_y + 48 * scale)))
    
    return center_y + wordmark_height / 2


def make_clean_splash(width: int, height: int) -> Image.Image:
    image = Image.new("RGBA", (width, height), BG)
    
    # Determine a good scale factor. For pure typography, we want it a bit larger
    # than it was in the old layout.
    scale = min(width / 393, height / 852) * 1.5 
    
    center_x = width / 2
    center_y = height / 2

    draw_wordmark(image, center_x, center_y, scale)
    
    return image


def main() -> None:
    if not PLAYFAIR_ITALIC_FONT.exists():
        raise SystemExit(f"Missing font: {PLAYFAIR_ITALIC_FONT}")

    print("Generating clean typography splash screens...")
    
    for target in IOS_TARGETS:
        target.parent.mkdir(parents=True, exist_ok=True)
        # Standard iOS splash dimensions
        make_clean_splash(2732, 2732).save(target)
        print(f"Generated: {target.name}")

    for target, size in ANDROID_TARGETS.items():
        target.parent.mkdir(parents=True, exist_ok=True)
        splash = make_clean_splash(*size)
        splash.save(target)
        print(f"Generated: {target.parent.name}/{target.name}")
        
    print("Done!")


if __name__ == "__main__":
    main()
