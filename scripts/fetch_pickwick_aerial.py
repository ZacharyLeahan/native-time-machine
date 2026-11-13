"""Download aspect-correct official aerial exports used by the app."""

from __future__ import annotations

import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image


SERVICE_ROOT = "https://imagery.pasda.psu.edu/arcgis/rest/services/"
BBOX_WGS84 = (-75.53185, 40.02810, -75.53065, 40.02915)
PUBLIC_DIR = Path(__file__).resolve().parents[1] / "public"
EXPORTS = (
    (
        f"{SERVICE_ROOT}PEMAImagery2021_2023/MapServer/export",
        PUBLIC_DIR / "pickwick-pema-2021-4096.png",
        3584,
        4096,
        "show:3",
    ),
    (
        f"{SERVICE_ROOT}pasda/NAIP2024/MapServer/export",
        PUBLIC_DIR / "pickwick-naip-2024.png",
        1792,
        2048,
        None,
    ),
)


def download(service: str, output: Path, width: int, height: int, layers: str | None) -> None:
    parameters = {
        "bbox": ",".join(str(value) for value in BBOX_WGS84),
        "bboxSR": "4326",
        "imageSR": "3857",
        # Match the Web Mercator aspect ratio of the requested bounds. ArcGIS
        # otherwise pads the narrower axis, which makes the photo disagree with
        # the parcel even though both inputs are correctly georeferenced.
        "size": f"{width},{height}",
        "format": "png32",
        "transparent": "false",
        "f": "image",
    }
    if layers:
        parameters["layers"] = layers
    url = f"{service}?{urllib.parse.urlencode(parameters)}"
    temporary = output.with_suffix(".download.png")
    try:
        urllib.request.urlretrieve(url, temporary)
        with Image.open(temporary) as image:
            if image.size != (width, height):
                raise RuntimeError(f"Unexpected export size: {image.size}")
            extrema = image.convert("RGB").getextrema()
            if all(low == high for low, high in extrema):
                raise RuntimeError("The imagery service returned a blank export")
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(output)


def main() -> None:
    for export in EXPORTS:
        download(*export)


if __name__ == "__main__":
    main()
