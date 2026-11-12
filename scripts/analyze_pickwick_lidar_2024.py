"""Inspect the 2024-2025 public LiDAR at 15 Pickwick Lane.

This script deliberately produces *stem candidates*, not an accepted tree
inventory. Airborne crown peaks and watershed segments are not treated as
trunks. Candidate support is based on repeated low-height returns at the same
horizontal location across several one-foot slices.

Run with:
    .venv/Scripts/python scripts/analyze_pickwick_lidar_2024.py \
      data/raw/27002580PAS_SE_SE.laz
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import laspy
import matplotlib.pyplot as plt
import numpy as np
from scipy.ndimage import maximum_filter
from scipy.spatial import cKDTree


SITE_CENTER_FT = np.array([2589774.5, 261100.4375])
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


def point_in_polygon(points: np.ndarray, polygon: np.ndarray) -> np.ndarray:
    x, y = points[:, 0], points[:, 1]
    inside = np.zeros(len(points), dtype=bool)
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        crosses = (yi > y) != (yj > y)
        crossing_x = (xj - xi) * (y - yi) / ((yj - yi) + 1e-30) + xi
        inside ^= crosses & (x < crossing_x)
        j = i
    return inside


def read_context(path: Path, buffer_ft: float = 75.0) -> dict[str, np.ndarray]:
    low = PARCEL_LOCAL_FT.min(axis=0) - buffer_ft
    high = PARCEL_LOCAL_FT.max(axis=0) + buffer_ft
    columns: dict[str, list[np.ndarray]] = {
        name: [] for name in ("x", "z", "elevation", "classification", "return_number", "number_of_returns")
    }
    with laspy.open(path, laz_backend=laspy.LazBackend.Laszip) as reader:
        for chunk in reader.chunk_iterator(1_000_000):
            x = np.asarray(chunk.x) - SITE_CENTER_FT[0]
            z = np.asarray(chunk.y) - SITE_CENTER_FT[1]
            keep = (x >= low[0]) & (x <= high[0]) & (z >= low[1]) & (z <= high[1])
            if not np.any(keep):
                continue
            columns["x"].append(x[keep])
            columns["z"].append(z[keep])
            columns["elevation"].append(np.asarray(chunk.z)[keep])
            columns["classification"].append(np.asarray(chunk.classification)[keep])
            columns["return_number"].append(np.asarray(chunk.return_number)[keep])
            columns["number_of_returns"].append(np.asarray(chunk.number_of_returns)[keep])
    return {name: np.concatenate(values) for name, values in columns.items()}


def normalize_heights(data: dict[str, np.ndarray]) -> np.ndarray:
    ground = data["classification"] == 2
    ground_xy = np.column_stack((data["x"][ground], data["z"][ground]))
    tree = cKDTree(ground_xy)
    query_xy = np.column_stack((data["x"], data["z"]))
    distances, indices = tree.query(query_xy, k=min(8, len(ground_xy)))
    if distances.ndim == 1:
        distances = distances[:, None]
        indices = indices[:, None]
    weights = 1 / np.maximum(distances, 0.25) ** 2
    ground_elevation = np.sum(data["elevation"][ground][indices] * weights, axis=1) / np.sum(weights, axis=1)
    return data["elevation"] - ground_elevation


def stem_support_grid(data: dict[str, np.ndarray], height: np.ndarray, cell_ft: float = 1.0):
    low = PARCEL_LOCAL_FT.min(axis=0) - 25
    high = PARCEL_LOCAL_FT.max(axis=0) + 25
    x_edges = np.arange(low[0], high[0] + cell_ft, cell_ft)
    z_edges = np.arange(low[1], high[1] + cell_ft, cell_ft)
    allowed_class = np.isin(data["classification"], [1, 3, 4, 5])
    not_building = ~point_in_polygon(np.column_stack((data["x"], data["z"])), BUILDING_LOCAL_FT)
    base = allowed_class & not_building
    support = np.zeros((len(x_edges) - 1, len(z_edges) - 1), dtype=np.uint8)
    total = np.zeros_like(support, dtype=np.uint16)
    for floor in range(1, 8):
        selected = base & (height >= floor) & (height < floor + 1)
        counts, _, _ = np.histogram2d(data["x"][selected], data["z"][selected], bins=(x_edges, z_edges))
        occupied = maximum_filter(counts, size=3) >= 1
        support += occupied
        total += counts.astype(np.uint16)
    return support, total, x_edges, z_edges


def extract_candidates_from_returns(data: dict[str, np.ndarray], height: np.ndarray):
    xy = np.column_stack((data["x"], data["z"]))
    in_parcel = point_in_polygon(xy, PARCEL_LOCAL_FT)
    outside_building = ~point_in_polygon(xy, BUILDING_LOCAL_FT)
    low_mask = (
        (data["classification"] == 1)
        & in_parcel
        & outside_building
        & (height >= 1)
        & (height < 8)
    )
    low_xy = xy[low_mask]
    low_height = height[low_mask]
    if not len(low_xy):
        return []
    tree = cKDTree(low_xy)
    vertically_supported = np.zeros(len(low_xy), dtype=bool)
    local_support = np.zeros(len(low_xy), dtype=np.uint8)
    for point_index, point in enumerate(low_xy):
        neighbors = tree.query_ball_point(point, r=1.25)
        slices = np.unique(np.floor(low_height[neighbors]).astype(int))
        local_support[point_index] = len(slices)
        vertically_supported[point_index] = len(slices) >= 4 and len(neighbors) >= 4
    supported_xy = low_xy[vertically_supported]
    if not len(supported_xy):
        return []

    # Link nearby supported returns into one stem hypothesis without requiring
    # scikit-learn. A union-find keeps this deterministic and easy to audit.
    parent = np.arange(len(supported_xy))

    def find(value: int) -> int:
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    def union(first: int, second: int) -> None:
        root_first, root_second = find(first), find(second)
        if root_first != root_second:
            parent[root_second] = root_first

    for first, second in cKDTree(supported_xy).query_pairs(r=2.0):
        union(first, second)
    groups: dict[int, list[int]] = {}
    for point_index in range(len(supported_xy)):
        groups.setdefault(find(point_index), []).append(point_index)

    candidates = []
    for group in groups.values():
        group_xy = supported_xy[group]
        center = np.median(group_xy, axis=0)
        nearby = tree.query_ball_point(center, r=1.5)
        slices = np.unique(np.floor(low_height[nearby]).astype(int))
        if len(slices) < 4 or len(nearby) < 4:
            continue
        candidates.append(
            {
                "candidate_id": f"SC{len(candidates) + 1:02d}",
                "local_x_ft": round(float(center[0]), 2),
                "local_z_ft": round(float(center[1]), 2),
                "supporting_height_slices": int(len(slices)),
                "low_return_count_within_1_5_ft": int(len(nearby)),
                "supported_return_count": int(len(group)),
                "status": "remote_candidate_not_accepted",
            }
        )
    return candidates


def plot_diagnostic(data, height, support, x_edges, z_edges, candidates, output: Path):
    parcel = np.vstack((PARCEL_LOCAL_FT, PARCEL_LOCAL_FT[0]))
    building = np.vstack((BUILDING_LOCAL_FT, BUILDING_LOCAL_FT[0]))
    fig, axes = plt.subplots(1, 3, figsize=(18, 6), constrained_layout=True)
    inside_context = (height >= 0.5) & (height <= 100)
    axes[0].scatter(data["x"][inside_context], data["z"][inside_context], c=np.clip(height[inside_context], 0, 70), s=0.35, cmap="viridis")
    axes[0].set_title("All above-ground returns (height color)")
    low_returns = np.isin(data["classification"], [1, 3, 4, 5]) & (height >= 1) & (height <= 8)
    axes[1].scatter(data["x"][low_returns], data["z"][low_returns], c=height[low_returns], s=2, cmap="plasma")
    axes[1].set_title("Potential structure returns, 1–8 ft")
    image = axes[2].imshow(
        support.T,
        origin="lower",
        extent=(x_edges[0], x_edges[-1], z_edges[0], z_edges[-1]),
        cmap="magma",
        vmin=0,
        vmax=7,
        interpolation="nearest",
    )
    fig.colorbar(image, ax=axes[2], label="occupied one-foot height slices")
    axes[2].set_title("Stacked low-height support")
    for axis in axes:
        axis.plot(parcel[:, 0], parcel[:, 1], color="#f5d547", linewidth=1.8)
        axis.plot(building[:, 0], building[:, 1], color="#36d9ed", linewidth=1.5)
        for candidate in candidates:
            axis.plot(candidate["local_x_ft"], candidate["local_z_ft"], "wo", markersize=5, markeredgecolor="black")
            axis.text(candidate["local_x_ft"] + 2, candidate["local_z_ft"] + 2, candidate["candidate_id"], color="white", fontsize=8, path_effects=[])
        axis.set_aspect("equal")
        axis.set_xlabel("local east (ft)")
        axis.set_ylabel("local north (ft)")
    fig.savefig(output, dpi=180)
    plt.close(fig)


def main() -> None:
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "data/raw/27002580PAS_SE_SE.laz")
    output_dir = Path("data/analysis")
    output_dir.mkdir(parents=True, exist_ok=True)
    with laspy.open(source, laz_backend=laspy.LazBackend.Laszip) as reader:
        header = reader.header
        header_summary = {
            "las_version": str(header.version),
            "point_format": str(header.point_format.id),
            "tile_point_count": int(header.point_count),
            "bounds": {"min": header.mins.tolist(), "max": header.maxs.tolist()},
            "scales": header.scales.tolist(),
        }
    data = read_context(source)
    height = normalize_heights(data)
    support, total, x_edges, z_edges = stem_support_grid(data, height)
    candidates = extract_candidates_from_returns(data, height)
    local_xy = np.column_stack((data["x"], data["z"]))
    in_parcel = point_in_polygon(local_xy, PARCEL_LOCAL_FT)
    parcel_area = abs(np.dot(PARCEL_LOCAL_FT[:, 0], np.roll(PARCEL_LOCAL_FT[:, 1], 1)) - np.dot(PARCEL_LOCAL_FT[:, 1], np.roll(PARCEL_LOCAL_FT[:, 0], 1))) / 2
    report = {
        "source": str(source),
        "tile": header_summary,
        "context_point_count": int(len(height)),
        "parcel_point_count": int(in_parcel.sum()),
        "parcel_all_return_density_per_sq_ft": round(float(in_parcel.sum() / parcel_area), 3),
        "classification_histogram_context": dict(sorted(Counter(map(int, data["classification"])).items())),
        "return_number_histogram_context": dict(sorted(Counter(map(int, data["return_number"])).items())),
        "parcel_height_percentiles_ft": {
            str(percentile): round(float(np.percentile(height[in_parcel], percentile)), 2)
            for percentile in (1, 5, 50, 95, 99, 99.9)
        },
        "candidate_rule": "actual unclassified returns within a 1.25-ft radius in at least four distinct one-foot slices from 1-8 ft; linked stem center must remain inside the parcel",
        "stem_candidates": candidates,
        "warning": "Candidates are not accepted trees. Poles, branches, shrubs, fences, and building-adjacent artifacts require manual point-cloud and field verification.",
    }
    report_path = output_dir / "pickwick_lidar_2024_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    plot_path = output_dir / "pickwick_lidar_2024_diagnostic.png"
    plot_diagnostic(data, height, support, x_edges, z_edges, candidates, plot_path)
    print(json.dumps(report, indent=2))
    print(plot_path)


if __name__ == "__main__":
    main()
