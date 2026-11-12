"""Extract existing tree geometry for 15 Pickwick Ln from public USGS EPT LiDAR.

The source is the USGS 3DEP public-domain point cloud
USGS_LPC_MD_PA_SandySupp_2014_LAS_2016.  The script streams only octree nodes
that intersect a small buffer around the parcel, normalizes returns against
classified ground points, detects canopy peaks, and prints JSON in the local
feet coordinate system used by the planner.

Run with:
    .venv/Scripts/python scripts/analyze_pickwick_lidar.py
"""

from __future__ import annotations

import io
import json
import math
import tempfile
from collections import Counter
from pathlib import Path
from typing import Iterable

import laspy
import matplotlib.pyplot as plt
import numpy as np
import requests
from scipy.ndimage import gaussian_filter, maximum_filter
from scipy.spatial import cKDTree
from skimage.feature import peak_local_max
from skimage.segmentation import watershed


EPT_ROOT = (
    "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/"
    "USGS_LPC_MD_PA_SandySupp_2014_LAS_2016"
)

# Official Chester County parcel ring, requested from the county feature layer
# in EPSG:4326 on 2026-11-11. The repeated closing vertex is omitted.
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

# Matching vertices in the planner's local coordinate system (feet).
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
    return np.column_stack((radius * lon, radius * np.log(np.tan(np.pi / 4 + lat / 2))))


PARCEL_XY = web_mercator(PARCEL_LON_LAT)

# Least-squares affine transform from EPSG:3857 to planner-local feet.
AFFINE = np.linalg.lstsq(
    np.column_stack((PARCEL_XY, np.ones(len(PARCEL_XY)))),
    PARCEL_LOCAL_FT,
    rcond=None,
)[0]


def to_local(points_xy: np.ndarray) -> np.ndarray:
    return np.column_stack((points_xy, np.ones(len(points_xy)))) @ AFFINE


def point_in_polygon(points: np.ndarray, polygon: np.ndarray) -> np.ndarray:
    x, y = points[:, 0], points[:, 1]
    inside = np.zeros(len(points), dtype=bool)
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        crosses = (yi > y) != (yj > y)
        x_cross = (xj - xi) * (y - yi) / ((yj - yi) + 1e-30) + xi
        inside ^= crosses & (x < x_cross)
        j = i
    return inside


def node_bounds(root_bounds: list[float], key: str) -> tuple[float, ...]:
    depth, ix, iy, iz = (int(value) for value in key.split("-"))
    divisions = 2**depth
    minx, miny, minz, maxx, maxy, maxz = root_bounds
    sx, sy, sz = (maxx - minx) / divisions, (maxy - miny) / divisions, (maxz - minz) / divisions
    return (
        minx + ix * sx, miny + iy * sy, minz + iz * sz,
        minx + (ix + 1) * sx, miny + (iy + 1) * sy, minz + (iz + 1) * sz,
    )


def intersects(bounds: tuple[float, ...], roi: tuple[float, ...]) -> bool:
    return not (
        bounds[3] < roi[0] or bounds[0] > roi[3]
        or bounds[4] < roi[1] or bounds[1] > roi[4]
        or bounds[5] < roi[2] or bounds[2] > roi[5]
    )


def hierarchy_nodes(root_bounds: list[float], roi: tuple[float, ...]) -> list[tuple[str, int]]:
    pages = ["0-0-0-0"]
    visited: set[str] = set()
    nodes: dict[str, int] = {}
    while pages:
        page = pages.pop()
        if page in visited:
            continue
        visited.add(page)
        response = requests.get(f"{EPT_ROOT}/ept-hierarchy/{page}.json", timeout=60)
        response.raise_for_status()
        for key, count in response.json().items():
            if not intersects(node_bounds(root_bounds, key), roi):
                continue
            if count == -1:
                pages.append(key)
            elif count > 0:
                nodes[key] = count
    return sorted(nodes.items(), key=lambda item: tuple(int(v) for v in item[0].split("-")))


def stream_points(nodes: Iterable[tuple[str, int]], roi: tuple[float, ...]) -> dict[str, np.ndarray]:
    chunks: dict[str, list[np.ndarray]] = {name: [] for name in ("x", "y", "z", "classification")}
    for index, (key, expected_count) in enumerate(nodes, start=1):
        response = requests.get(f"{EPT_ROOT}/ept-data/{key}.laz", timeout=120)
        response.raise_for_status()
        cloud = laspy.read(io.BytesIO(response.content))
        x, y, z = np.asarray(cloud.x), np.asarray(cloud.y), np.asarray(cloud.z)
        keep = (
            (x >= roi[0]) & (x <= roi[3])
            & (y >= roi[1]) & (y <= roi[4])
            & (z >= roi[2]) & (z <= roi[5])
        )
        if np.any(keep):
            chunks["x"].append(x[keep])
            chunks["y"].append(y[keep])
            chunks["z"].append(z[keep])
            chunks["classification"].append(np.asarray(cloud.classification)[keep].astype(np.uint8))
        print(
            f"node {index:02}/{len(nodes):02} {key}: {expected_count:,} total, {int(keep.sum()):,} in ROI",
            flush=True,
        )
    return {name: np.concatenate(values) if values else np.array([]) for name, values in chunks.items()}


def detect_trees(points: dict[str, np.ndarray]) -> list[dict[str, float | int]]:
    x, y, z, classification = (points[name] for name in ("x", "y", "z", "classification"))
    ground_mask = classification == 2
    if ground_mask.sum() < 20:
        raise RuntimeError("Not enough classified ground returns to normalize canopy heights")

    ground_tree = cKDTree(np.column_stack((x[ground_mask], y[ground_mask])))
    _, ground_index = ground_tree.query(np.column_stack((x, y)), k=1)
    ground_z = z[ground_mask][ground_index]
    height = z - ground_z
    local = to_local(np.column_stack((x, y)))

    in_parcel = point_in_polygon(local, PARCEL_LOCAL_FT)
    near_building = point_in_polygon(local, BUILDING_LOCAL_FT)
    vegetation_class = np.isin(classification, [3, 4, 5])
    # Some older 3DEP projects leave canopy as class 1. Include those returns,
    # while excluding the known house footprint and implausibly tall objects.
    candidate = (
        in_parcel & ~near_building & (height >= 6 * 0.3048) & (height <= 140 * 0.3048)
        & (vegetation_class | (classification == 1))
    )
    vx, vy, vh = x[candidate], y[candidate], height[candidate]
    if len(vx) < 50:
        raise RuntimeError("Not enough vegetation returns inside the parcel")

    cell = 0.65
    xmin, ymin = PARCEL_XY.min(axis=0) - 2
    xmax, ymax = PARCEL_XY.max(axis=0) + 2
    width = int(math.ceil((xmax - xmin) / cell)) + 1
    height_cells = int(math.ceil((ymax - ymin) / cell)) + 1
    canopy = np.zeros((height_cells, width), dtype=np.float32)
    cols = np.clip(((vx - xmin) / cell).astype(int), 0, width - 1)
    rows = np.clip(((vy - ymin) / cell).astype(int), 0, height_cells - 1)
    np.maximum.at(canopy, (rows, cols), vh)
    filled = maximum_filter(canopy, size=3)
    smooth = gaussian_filter(filled, sigma=1.2)
    canopy_mask = smooth >= 2.1
    peak_cells = peak_local_max(
        smooth,
        min_distance=6,
        threshold_abs=3.0,
        labels=canopy_mask,
        exclude_border=False,
    )
    valid_peaks: list[tuple[int, int]] = []
    for row, col in peak_cells:
        point = np.array([xmin + (col + 0.5) * cell, ymin + (row + 0.5) * cell])
        local_point = to_local(point.reshape(1, 2))[0]
        if point_in_polygon(local_point.reshape(1, 2), PARCEL_LOCAL_FT)[0]:
            valid_peaks.append((int(row), int(col)))

    markers = np.zeros_like(canopy, dtype=np.int32)
    for marker, (row, col) in enumerate(valid_peaks, start=1):
        markers[row, col] = marker
    crown_labels = watershed(-smooth, markers, mask=canopy_mask)
    trees: list[dict[str, float | int]] = []
    for marker, (peak_row, peak_col) in enumerate(valid_peaks, start=1):
        assigned = (crown_labels[rows, cols] == marker) & (vh >= 1.8)
        if assigned.sum() < 12:
            continue
        px, py, ph = vx[assigned], vy[assigned], vh[assigned]
        top_cutoff = np.quantile(ph, 0.8)
        top = ph >= top_cutoff
        center = np.array([np.average(px[top], weights=ph[top]), np.average(py[top], weights=ph[top])])
        crown_area = float(np.count_nonzero(crown_labels == marker) * cell * cell)
        crown_diameter = 2 * math.sqrt(crown_area / math.pi)
        local_center = to_local(center.reshape(1, 2))[0]
        trees.append(
            {
                "xFt": round(float(local_center[0]), 1),
                "zFt": round(float(local_center[1]), 1),
                "heightFt": round(float(np.quantile(ph, 0.98) / 0.3048), 1),
                "crownDiameterFt": round(float(crown_diameter / 0.3048), 1),
                "returns": int(assigned.sum()),
            }
        )
    trees = sorted(trees, key=lambda tree: (-float(tree["heightFt"]), float(tree["xFt"])))

    figure, axis = plt.subplots(figsize=(8, 9), dpi=160)
    scatter = axis.scatter(local[candidate, 0], local[candidate, 1], c=height[candidate] / 0.3048,
                           s=2, cmap="viridis", vmin=6, vmax=75)
    closed_parcel = np.vstack((PARCEL_LOCAL_FT, PARCEL_LOCAL_FT[0]))
    closed_house = np.vstack((BUILDING_LOCAL_FT, BUILDING_LOCAL_FT[0]))
    axis.plot(closed_parcel[:, 0], closed_parcel[:, 1], color="white", linewidth=1.4)
    axis.fill(closed_house[:, 0], closed_house[:, 1], color="#d7c2a3", alpha=0.9)
    for number, tree in enumerate(trees, start=1):
        radius = float(tree["crownDiameterFt"]) / 2
        axis.add_patch(plt.Circle((float(tree["xFt"]), float(tree["zFt"])), radius,
                                  fill=False, edgecolor="#ffca58", linewidth=0.8, alpha=0.75))
        axis.text(float(tree["xFt"]), float(tree["zFt"]), str(number), color="white",
                  ha="center", va="center", fontsize=6)
    axis.set_aspect("equal")
    axis.set_facecolor("#172019")
    axis.set_title("15 Pickwick Ln — 2014 USGS LiDAR canopy returns")
    axis.set_xlabel("local east/west (ft)")
    axis.set_ylabel("local north/south (ft)")
    figure.colorbar(scatter, ax=axis, label="height above ground (ft)")
    figure.tight_layout()
    plot_path = Path(tempfile.gettempdir()) / "pickwick-lidar-canopy.png"
    figure.savefig(plot_path, facecolor="white")
    plt.close(figure)
    print(f"Canopy diagnostic: {plot_path}", flush=True)
    return trees


def main() -> None:
    metadata = requests.get(f"{EPT_ROOT}/ept.json", timeout=60).json()
    buffer_m = 8.0
    minx, miny = PARCEL_XY.min(axis=0) - buffer_m
    maxx, maxy = PARCEL_XY.max(axis=0) + buffer_m
    roi = (float(minx), float(miny), 0.0, float(maxx), float(maxy), 500.0)
    nodes = hierarchy_nodes(metadata["bounds"], roi)
    print(f"Found {len(nodes)} intersecting EPT nodes", flush=True)
    points = stream_points(nodes, roi)
    print(f"Clipped {len(points['x']):,} points", flush=True)
    print("Class counts:", dict(sorted(Counter(points["classification"].tolist()).items())), flush=True)
    trees = detect_trees(points)
    print(json.dumps({"source": EPT_ROOT, "trees": trees}, indent=2))


if __name__ == "__main__":
    main()
