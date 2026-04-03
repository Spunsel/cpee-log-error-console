from PIL import Image, ImageDraw, ImageFont
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "/legend-numbering/numbers")
os.makedirs(OUTPUT_DIR, exist_ok=True)

SIZE = 512
CIRCLE_COLOR = "#FF6600"
TEXT_COLOR = "#FFFFFF"
PADDING = 16


def generate_number_image(n: int):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.ellipse([PADDING, PADDING, SIZE - PADDING, SIZE - PADDING], fill=CIRCLE_COLOR)

    font = None
    font_size = 240 if n < 10 else 190
    font_paths = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/verdanab.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            font = ImageFont.truetype(path, font_size)
            break
    if font is None:
        font = ImageFont.load_default()

    text = str(n)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (SIZE - text_w) / 2 - bbox[0]
    y = (SIZE - text_h) / 2 - bbox[1]

    draw.text((x, y), text, fill=TEXT_COLOR, font=font)

    out_path = os.path.join(OUTPUT_DIR, f"{n}.png")
    img.save(out_path, "PNG")
    print(f"Saved {out_path}")


for i in range(1, 21):
    generate_number_image(i)

print("Done. 20 images generated in scripts/numbers/")


def generate_number_image_green(n: int):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.ellipse([PADDING, PADDING, SIZE - PADDING, SIZE - PADDING], fill="#A2AD00")

    font = None
    font_size = 240 if n < 10 else 190
    font_paths = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/verdanab.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            font = ImageFont.truetype(path, font_size)
            break
    if font is None:
        font = ImageFont.load_default()

    text = str(n)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (SIZE - text_w) / 2 - bbox[0]
    y = (SIZE - text_h) / 2 - bbox[1]

    draw.text((x, y), text, fill=TEXT_COLOR, font=font)

    out_path = os.path.join(OUTPUT_DIR, f"{n}_green.png")
    img.save(out_path, "PNG")
    print(f"Saved {out_path}")


for i in range(1, 21):
    generate_number_image_green(i)

print("Done. 20 green images generated in scripts/numbers/")
