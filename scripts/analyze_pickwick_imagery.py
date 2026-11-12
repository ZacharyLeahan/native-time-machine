"""Align official aerial imagery with the 15 Pickwick Lane site model.

The input images are ArcGIS exports made with the same WGS84 bounding box and
Web Mercator output projection.  This script overlays the county parcel and
building footprint, expressed in the planner's local feet coordinate system,
so that trees belonging to neighboring parcels are not counted by mistake.
"""

from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import binary_closing, binary_opening, distance_transform_edt
from skimage.feature import peak_local_max


BBOX_WGS84 = (-75.53185, 40.02810, -75.53065, 40.02915)

PARCEL_LON_LAT = np.array(
    [
        [-75.5308902813614, 40.0284796908915],
        [-75.5309970444361, 40.0284350242964],
        [-75.5312070690737, 40.0283461092166],
        [-75.5312268675695, 40.0283396241192],
        [-75.5312479526968, 40.0283363120765],
        [-75.5312694734839, 40.0283363067587],
        [-75.5312905613765, 40.0283396083804],
        [-75.5313103652913, 40.0283460836919],
        [-75.5313280859643, 40.0283554713571],
        [-75.5313430082082, 40.0283673925003],
        [-75.5313545297758, 40.0283813659973],
        [-75.5313666305624, 40.0283999373852],
        [-75.5315974458133, 40.0287295551420],
        [-75.5311895820038, 40.0289007682189],
    ],
    dtype=float,
)

PARCEL_LOCAL_FT = np.array(
    [
        [106.407, -63.690], [76.927, -80.707], [18.943, -114.565],
        [13.460, -117.066], [7.587, -118.420], [1.563, -118.573],
        [-4.371, -117.520], [-9.975, -115.301], [-15.022, -112.007],
        [-19.308, -107.770], [-22.662, -102.763], [-26.219, -96.085],
        [-93.853, 22.328], [18.763, 87.547],
    ],
    dtype=float,
)

BUILDING_LOCAL_FT = np.array(
    [
        [37.949, -31.960], [19.089, -43.276], [21.831, -47.847],
        [-1.389, -61.779], [-3.534, -58.204], [-9.508, -48.246],
        [-16.258, -36.996], [-16.614, -36.405], [-9.508, -32.141],
        [-9.240, -31.980], [6.386, -22.604], [9.233, -20.896],
        [10.274, -22.630], [26.507, -12.890],
    ],
    dtype=float,
)


def web_mercator(points: np.ndarray) -> np.ndarray:
    radius = 6378137.0
    lon = np.radians(points[:, 0])
    lat = np.radians(np.clip(points[:, 1], -85.05112878, 85.05112878))
    return np.column_stack(
        (radius * lon, radius * np.log(np.tan(np.pi / 4 + lat / 2)))
    )


PARCEL_MERCATOR = web_mercator(PARCEL_LON_LAT)
LOCAL_TO_MERCATOR = np.linalg.lstsq(
    np.column_stack((PARCEL_LOCAL_FT, np.ones(len(PARCEL_LOCAL_FT)))),
    PARCEL_MERCATOR,
    rcond=None,
)[0]


def local_to_pixels(points: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    mercator = np.column_stack((points, np.ones(len(points)))) @ LOCAL_TO_MERCATOR
    west, south, east, north = BBOX_WGS84
    bounds = web_mercator(np.array([[west, south], [east, north]], dtype=float))
    width, height = size
    x = (mercator[:, 0] - bounds[0, 0]) / (bounds[1, 0] - bounds[0, 0]) * width
    y = (bounds[1, 1] - mercator[:, 1]) / (bounds[1, 1] - bounds[0, 1]) * height
    return np.column_stack((x, y))


def outlined_polygon(draw: ImageDraw.ImageDraw, points: np.ndarray, color: str) -> None:
    coordinates = [tuple(point) for point in points]
    draw.line(coordinates + [coordinates[0]], fill="black", width=9, joint="curve")
    draw.line(coordinates + [coordinates[0]], fill=color, width=5, joint="curve")


def annotate(source: Path, title: str) -> Image.Image:
    image = Image.open(source).convert("RGB")
    draw = ImageDraw.Draw(image)
    parcel = local_to_pixels(PARCEL_LOCAL_FT, image.size)
    building = local_to_pixels(BUILDING_LOCAL_FT, image.size)
    outlined_polygon(draw, parcel, "#ffe34d")
    outlined_polygon(draw, building, "#43e5ff")
    draw.rectangle((12, 12, 780, 68), fill=(0, 0, 0, 205))
    draw.text((24, 23), title, fill="white", font=ImageFont.load_default(size=30))
    return image


def canopy_candidates(source: Path) -> np.ndarray:
    """Return conservative crown centers from the 2024 CIR rendering.

    The rendered color-infrared layer is not raw multispectral data, so this is
    deliberately a visual aid rather than an automated inventory. Dark,
    strongly infrared-reflective crown interiors are separated from bright lawn
    and then split with a distance-transform peak search.
    """
    image = Image.open(source).convert("RGB")
    pixels = np.asarray(image)
    red, green, blue = [pixels[:, :, channel].astype(float) for channel in range(3)]
    parcel_mask_image = Image.new("1", image.size)
    parcel_draw = ImageDraw.Draw(parcel_mask_image)
    parcel_draw.polygon([tuple(point) for point in local_to_pixels(PARCEL_LOCAL_FT, image.size)], fill=1)
    parcel_draw.polygon([tuple(point) for point in local_to_pixels(BUILDING_LOCAL_FT, image.size)], fill=0)
    parcel_mask = np.asarray(parcel_mask_image, dtype=bool)
    canopy = parcel_mask & (red - green > 72) & (red < 176) & (blue < 88)
    canopy = binary_closing(binary_opening(canopy, iterations=2), iterations=5)
    distance = distance_transform_edt(canopy)
    return peak_local_max(distance, min_distance=34, threshold_abs=10)


def main() -> None:
    imagery_dir = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path(os.environ.get("TEMP", ".")) / "pickwick-free-imagery"
    )
    layers = [
        ("naip2024_rgb.png", "2024 NAIP leaf-on RGB"),
        ("naip2024_cir.png", "2024 NAIP leaf-on color infrared"),
        ("pema2021_leaf_off.png", "2021 PEMA six-inch leaf-off"),
    ]
    annotated = [annotate(imagery_dir / filename, title) for filename, title in layers]
    montage = Image.new("RGB", (2400, 2400), "#111418")
    montage.paste(annotated[0], (0, 0))
    montage.paste(annotated[1], (1200, 0))
    montage.paste(annotated[2], (0, 1200))
    legend = ImageDraw.Draw(montage)
    legend.text((1250, 1300), "Yellow: parcel\nCyan: house footprint", fill="white", font=ImageFont.load_default(size=36), spacing=18)
    output = imagery_dir / "pickwick_imagery_overlay.png"
    montage.save(output)
    zooms: list[Image.Image] = []
    for image in annotated:
        zooms.append(image.crop((180, 220, 1020, 980)).resize((1260, 1140)))
    zoom_montage = Image.new("RGB", (2520, 2280), "#111418")
    zoom_montage.paste(zooms[0], (0, 0))
    zoom_montage.paste(zooms[1], (1260, 0))
    zoom_montage.paste(zooms[2], (0, 1140))
    zoom_output = imagery_dir / "pickwick_property_zoom.png"
    zoom_montage.save(zoom_output)
    candidates = canopy_candidates(imagery_dir / "naip2024_cir.png")
    candidate_preview = Image.new("RGB", (2400, 1200), "#111418")
    for panel_index, base in enumerate((annotated[1], annotated[2])):
        panel = base.copy()
        candidate_draw = ImageDraw.Draw(panel)
        for number, (row, column) in enumerate(candidates, start=1):
            candidate_draw.ellipse((column - 14, row - 14, column + 14, row + 14), fill="#ff3b30", outline="white", width=4)
            candidate_draw.text((column + 18, row - 18), str(number), fill="white", font=ImageFont.load_default(size=26), stroke_width=3, stroke_fill="black")
        candidate_preview.paste(panel, (panel_index * 1200, 0))
    candidate_output = imagery_dir / "pickwick_canopy_candidates.png"
    candidate_preview.save(candidate_output)
    print(output)
    print(zoom_output)
    print(candidate_output)
    print("candidate pixels (row, column):", candidates.tolist())


if __name__ == "__main__":
    main()
