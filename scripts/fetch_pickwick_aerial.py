"""Download the maximum-size official PEMA aerial export used by the app."""

from __future__ import annotations

import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image


SERVICE = (
    "https://imagery.pasda.psu.edu/arcgis/rest/services/"
    "PEMAImagery2021_2023/MapServer/export"
)
BBOX_WGS84 = (-75.53185, 40.02810, -75.53065, 40.02915)
IMAGE_SIZE = 4096
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "pickwick-pema-2021-4096.png"


def main() -> None:
    parameters = {
        "bbox": ",".join(str(value) for value in BBOX_WGS84),
        "bboxSR": "4326",
        "imageSR": "3857",
        "size": f"{IMAGE_SIZE},{IMAGE_SIZE}",
        "format": "png32",
        "transparent": "false",
        "layers": "show:3",
        "f": "image",
    }
    url = f"{SERVICE}?{urllib.parse.urlencode(parameters)}"
    temporary = OUTPUT.with_suffix(".download.png")
    try:
        urllib.request.urlretrieve(url, temporary)
        with Image.open(temporary) as image:
            if image.size != (IMAGE_SIZE, IMAGE_SIZE):
                raise RuntimeError(f"Unexpected export size: {image.size}")
            extrema = image.convert("RGB").getextrema()
            if all(low == high for low, high in extrema):
                raise RuntimeError("The imagery service returned a blank export")
        temporary.replace(OUTPUT)
    finally:
        temporary.unlink(missing_ok=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
