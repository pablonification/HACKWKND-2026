from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"
SPLASH_DIR = ASSETS_DIR / "splash"
SATOSHI_MEDIUM_FONT = FONTS_DIR / "Satoshi-Medium.ttf"
MANSALVA_FONT = FONTS_DIR / "Mansalva-Regular.ttf"
SPLASH_LOGO = SPLASH_DIR / "figma-splash-logo.png"
SPLASH_FOOTER = SPLASH_DIR / "generated-splash-footer.png"

BG = "#FFF9E9"
BLACK = "#060606"
GRADIENT_START = (45, 94, 153)
GRADIENT_END = (203, 64, 60)

DESIGN_WIDTH = 393
DESIGN_HEIGHT = 852
LOGO_X = 111
LOGO_Y = 322
LOGO_WIDTH = 160
LOGO_HEIGHT = 187
FOOTER_Y = 747
FOOTER_WIDTH = 139
FOOTER_HEIGHT = 42

IOS_SPLASH_DIR = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset"
ANDROID_RES_DIR = ROOT / "android" / "app" / "src" / "main" / "res"
ANDROID_LOGO_TARGET = ANDROID_RES_DIR / "drawable-nodpi" / "splash_logo.png"
ANDROID_BRANDING_TARGET = ANDROID_RES_DIR / "drawable-nodpi" / "splash_branding.png"


def font(path: Path, size: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), round(size))


def render_text_image(
    text: str,
    font_obj: ImageFont.FreeTypeFont,
    fill: str | tuple[int, int, int] | tuple[int, int, int, int],
    tracking: int = 0,
) -> Image.Image:
    left, top, right, bottom = font_obj.getbbox(text)
    width = right - left
    height = bottom - top
    pad = max(16, int(font_obj.size * 0.35))
    base = Image.new("RGBA", (width + pad * 4, height + pad * 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    x = pad - left
    y = pad - top
    for char in text:
        char_left, _, char_right, _ = font_obj.getbbox(char)
        draw.text((x, y), char, font=font_obj, fill=fill)
        x += (char_right - char_left) + tracking

    return base.crop(base.getbbox())


def render_gradient_text_image(
    text: str,
    font_obj: ImageFont.FreeTypeFont,
    start_color: tuple[int, int, int],
    end_color: tuple[int, int, int],
    tracking: int = 0,
) -> Image.Image:
    mask = render_text_image(text, font_obj, fill=(255, 255, 255, 255), tracking=tracking)
    width, height = mask.size
    gradient = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(gradient)
    for x in range(width):
        mix = x / max(width - 1, 1)
        color = tuple(
            round(start + (end - start) * mix) for start, end in zip(start_color, end_color)
        )
        draw.line([(x, 0), (x, height)], fill=(*color, 255))

    gradient.putalpha(mask.getchannel("A"))
    return gradient


def paste_with_alpha(base: Image.Image, overlay: Image.Image, xy: tuple[int, int]) -> None:
    base.alpha_composite(overlay, dest=xy)


def fit_size(width: int, height: int, max_width: int, max_height: int) -> tuple[int, int]:
    scale = min(max_width / width, max_height / height)
    return max(1, round(width * scale)), max(1, round(height * scale))


def build_footer_art(scale: int = 4) -> Image.Image:
    from_text = render_text_image(
        "from",
        font(SATOSHI_MEDIUM_FONT, 16 * scale),
        BLACK,
        tracking=round(scale),
    )
    lockup = render_gradient_text_image(
        "Ayo Ke malAI",
        font(MANSALVA_FONT, 24 * scale),
        GRADIENT_START,
        GRADIENT_END,
        tracking=round(-0.5 * scale),
    )

    content_width = max(from_text.width, lockup.width)
    top_pad = round(2 * scale)
    gap = round(12 * scale)
    bottom_pad = round(12 * scale)
    side_pad = round(6 * scale)
    canvas = Image.new(
        "RGBA",
        (content_width + side_pad * 2, top_pad + from_text.height + gap + lockup.height + bottom_pad),
        (0, 0, 0, 0),
    )

    from_x = round((canvas.width - from_text.width) / 2)
    lockup_x = round((canvas.width - lockup.width) / 2)
    paste_with_alpha(canvas, from_text, (from_x, top_pad))
    paste_with_alpha(canvas, lockup, (lockup_x, top_pad + from_text.height + gap))
    return canvas.crop(canvas.getbbox())


def native_targets() -> list[Path]:
    return sorted(ANDROID_RES_DIR.glob("**/splash.png"))


def ios_targets() -> list[Path]:
    return sorted(IOS_SPLASH_DIR.glob("Default@*~universal~anyany*.png"))


def make_clean_splash(width: int, height: int) -> Image.Image:
    image = Image.new("RGBA", (width, height), BG)
    scale = min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT)
    frame_width = DESIGN_WIDTH * scale
    frame_height = DESIGN_HEIGHT * scale
    origin_x = round((width - frame_width) / 2)
    origin_y = round((height - frame_height) / 2)

    logo = Image.open(SPLASH_LOGO).convert("RGBA")
    footer = Image.open(SPLASH_FOOTER).convert("RGBA")

    logo_size = fit_size(logo.width, logo.height, round(LOGO_WIDTH * scale), round(LOGO_HEIGHT * scale))
    footer_size = fit_size(
        footer.width,
        footer.height,
        round(FOOTER_WIDTH * scale),
        round(FOOTER_HEIGHT * scale),
    )

    logo = logo.resize(logo_size, Image.LANCZOS)
    footer = footer.resize(footer_size, Image.LANCZOS)

    logo_x = origin_x + round(LOGO_X * scale)
    logo_y = origin_y + round(LOGO_Y * scale)
    footer_x = round((width - footer.width) / 2)
    footer_y = origin_y + round(FOOTER_Y * scale)

    paste_with_alpha(image, logo, (logo_x, logo_y))
    paste_with_alpha(image, footer, (footer_x, footer_y))
    return image


def main() -> None:
    required = [SATOSHI_MEDIUM_FONT, MANSALVA_FONT, SPLASH_LOGO]
    for asset in required:
        if not asset.exists():
            raise SystemExit(f"Missing asset: {asset}")

    SPLASH_DIR.mkdir(parents=True, exist_ok=True)
    ANDROID_LOGO_TARGET.parent.mkdir(parents=True, exist_ok=True)

    footer = build_footer_art()
    footer.save(SPLASH_FOOTER)

    Image.open(SPLASH_LOGO).convert("RGBA").save(ANDROID_LOGO_TARGET)
    footer.save(ANDROID_BRANDING_TARGET)

    print("Generating Figma-based splash screens...")

    for extra in IOS_SPLASH_DIR.glob("splash-2732x2732*.png"):
        extra.unlink(missing_ok=True)

    for target in ios_targets():
        target.parent.mkdir(parents=True, exist_ok=True)
        make_clean_splash(2732, 2732).save(target)
        print(f"Generated: {target.name}")

    for target in native_targets():
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(target) as current:
            size = current.size
        splash = make_clean_splash(*size)
        splash.save(target)
        print(f"Generated: {target.parent.name}/{target.name}")

    print("Done!")


if __name__ == "__main__":
    main()
