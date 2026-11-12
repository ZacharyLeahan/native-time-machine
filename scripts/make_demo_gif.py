from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "docs" / "demo-frames"
output = root / "docs" / "native-time-machine-demo.gif"
frames = []

for path in sorted(source.glob("*.png")):
    image = Image.open(path).convert("RGB")
    target_width = 960
    target_height = round(image.height * target_width / image.width)
    image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
    frames.append(image.quantize(colors=128, method=Image.Quantize.MEDIANCUT))

if not frames:
    raise SystemExit("No demo frames found")

durations = []
paths = sorted(source.glob("*.png"))
for index, path in enumerate(paths):
    if "growth-year" in path.name:
        durations.append(420)
    elif "walk-mode" in path.name:
        durations.append(1500)
    else:
        durations.append([1100, 1100, 800, 800, 900, 1000][min(index, 5)])
frames[0].save(
    output,
    save_all=True,
    append_images=frames[1:],
    duration=durations[: len(frames)],
    loop=0,
    optimize=True,
    disposal=2,
)
print(output)
