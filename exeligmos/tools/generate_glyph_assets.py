#!/usr/bin/env python3
"""Render the canonical Exeligmos depth-five glyph as Zepp PNG layers."""

from __future__ import annotations

import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw


ASSET_SIZE = 176
ANTIALIAS = 4
CORE_ALPHA = 255
SOCKET_WIDTH = 16.0
CORE_RADIUS = 41.57
GRID_SIZE = 8.0
PADDING_CELLS = 2.0

RARITY_COLORS = {
    "white": "#FFFFFF",
    "blue": "#0A84FF",
    "purple": "#BF5AF2",
    "yellow": "#FFD60A",
    "red": "#FF453A",
}

DIM_COLORS = {
    "white": "#808080",
    "blue": "#054280",
    "purple": "#602D79",
    "yellow": "#806B05",
    "red": "#80231D",
}

ARROW_WIDTH = 24
ARROW_HEIGHT = 40

ARMS = {
    0: [(-8, 0), (8, 0)],
    1: [(-8, 0), (-24, 27.71), (-16, 41.57), (8, 0)],
    2: [(-8, 0), (-8, 96.99), (0, 110.85), (8, 96.99), (8, 0)],
    3: [(-8, 0), (-40, 55.42), (-8, 110.85), (0, 96.99), (-24, 55.42), (8, 0)],
    4: [(-8, 0), (16, 41.57), (24, 27.71), (8, 0)],
    5: [(-8, 0), (-40, 55.42), (24, 55.42), (32, 41.57), (-16, 41.57), (8, 0)],
    6: [(-8, 0), (-8, 138.56), (32, 69.28), (24, 55.42), (8, 83.14), (8, 0)],
    7: [
        (-8, 0),
        (-40, 55.42),
        (0, 124.71),
        (32, 69.28),
        (24, 55.42),
        (0, 96.99),
        (-24, 55.42),
        (8, 0),
    ],
}


def rotate(point: tuple[float, float], degrees: float) -> tuple[float, float]:
    radians = math.radians(degrees)
    cosine = math.cos(radians)
    sine = math.sin(radians)
    x, y = point
    return (x * cosine - y * sine, x * sine + y * cosine)


def make_sockets(count: int = 5) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    start = (-SOCKET_WIDTH / 2, -CORE_RADIUS)
    end = (SOCKET_WIDTH / 2, -CORE_RADIUS)
    return [(rotate(start, index * 360 / count), rotate(end, index * 360 / count)) for index in range(count)]


def signed_area(points: list[tuple[float, float]]) -> float:
    return sum(
        x * points[(index + 1) % len(points)][1]
        - points[(index + 1) % len(points)][0] * y
        for index, (x, y) in enumerate(points)
    )


def line_intersection(
    point_a: tuple[float, float],
    direction_a: tuple[float, float],
    point_b: tuple[float, float],
    direction_b: tuple[float, float],
) -> tuple[float, float] | None:
    cross = direction_a[0] * direction_b[1] - direction_a[1] * direction_b[0]
    if abs(cross) < 0.000001:
        return None
    delta = (point_b[0] - point_a[0], point_b[1] - point_a[1])
    factor = (delta[0] * direction_b[1] - delta[1] * direction_b[0]) / cross
    return (
        point_a[0] + direction_a[0] * factor,
        point_a[1] + direction_a[1] * factor,
    )


def inset_convex_polygon(points: list[tuple[float, float]], thickness: float) -> list[tuple[float, float]]:
    inward_sign = 1 if signed_area(points) >= 0 else -1
    lines: list[tuple[tuple[float, float], tuple[float, float]]] = []
    for index, point in enumerate(points):
        following = points[(index + 1) % len(points)]
        dx = following[0] - point[0]
        dy = following[1] - point[1]
        length = max(math.hypot(dx, dy), 0.001)
        normal = ((-dy / length) * inward_sign, (dx / length) * inward_sign)
        lines.append(
            (
                (point[0] + normal[0] * thickness, point[1] + normal[1] * thickness),
                (dx, dy),
            )
        )

    inset: list[tuple[float, float]] = []
    for index, point in enumerate(points):
        previous = lines[(index - 1) % len(lines)]
        current = lines[index]
        inset.append(line_intersection(previous[0], previous[1], current[0], current[1]) or point)
    return inset


def arm_to_world(
    points: list[tuple[float, float]],
    socket_index: int,
    sockets: list[tuple[tuple[float, float], tuple[float, float]]],
) -> list[tuple[float, float]]:
    if len(points) < 2:
        return points
    start, end = sockets[socket_index]
    center = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = max(math.hypot(dx, dy), 0.001)
    tangent = (dx / length, dy / length)
    outward = (tangent[1], -tangent[0])
    if outward[0] * center[0] + outward[1] * center[1] < 0:
        outward = (-outward[0], -outward[1])

    aligned = list(points)
    aligned[0] = (-length / 2, 0)
    aligned[-1] = (length / 2, 0)
    return [
        (
            center[0] + tangent[0] * x + outward[0] * y,
            center[1] + tangent[1] * x + outward[1] * y,
        )
        for x, y in aligned
    ]


def geometry() -> tuple[
    list[tuple[float, float]],
    list[tuple[float, float]],
    list[list[list[tuple[float, float]]]],
    tuple[float, float, float, float],
]:
    sockets = make_sockets()
    core = [point for socket in sockets for point in socket]
    hole = inset_convex_polygon(core, 14)
    arm_paths = [
        [arm_to_world(ARMS[digit], socket_index, sockets) for digit in range(8)]
        for socket_index in range(5)
    ]
    all_points = core + hole + [point for paths in arm_paths for path in paths for point in path]
    padding = GRID_SIZE * PADDING_CELLS
    half_width = math.ceil(max(abs(point[0]) for point in all_points) / GRID_SIZE) * GRID_SIZE + padding
    half_height = math.ceil(max(abs(point[1]) for point in all_points) / GRID_SIZE) * GRID_SIZE + padding
    bounds = (-half_width, -half_height, half_width * 2, half_height * 2)
    assert bounds == (-192.0, -200.0, 384.0, 400.0), bounds
    return core, hole, arm_paths, bounds


def parse_color(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def pixel_points(
    points: list[tuple[float, float]], bounds: tuple[float, float, float, float]
) -> list[tuple[float, float]]:
    min_x, min_y, width, height = bounds
    scale = min(ASSET_SIZE / width, ASSET_SIZE / height)
    rendered_width = width * scale
    rendered_height = height * scale
    x_offset = ASSET_SIZE / 2 - rendered_width / 2 - min_x * scale
    y_offset = ASSET_SIZE / 2 - rendered_height / 2 - min_y * scale
    return [
        ((x * scale + x_offset) * ANTIALIAS, (y * scale + y_offset) * ANTIALIAS)
        for x, y in points
    ]


def render_polygon(
    points: list[tuple[float, float]],
    bounds: tuple[float, float, float, float],
    color: tuple[int, int, int, int],
    hole: list[tuple[float, float]] | None = None,
) -> Image.Image:
    image = Image.new("RGBA", (ASSET_SIZE * ANTIALIAS, ASSET_SIZE * ANTIALIAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.polygon(pixel_points(points, bounds), fill=color)
    if hole:
        draw.polygon(pixel_points(hole, bounds), fill=(0, 0, 0, 0))
    return image.resize((ASSET_SIZE, ASSET_SIZE), Image.Resampling.LANCZOS)


def render_arrow(color: tuple[int, int, int, int], direction: str) -> Image.Image:
    image = Image.new(
        "RGBA",
        (ARROW_WIDTH * ANTIALIAS, ARROW_HEIGHT * ANTIALIAS),
        (0, 0, 0, 0),
    )
    draw = ImageDraw.Draw(image)
    points = (
        [(12, 8), (3, 26), (21, 26)]
        if direction == "future"
        else [(3, 14), (21, 14), (12, 32)]
    )
    draw.polygon(
        [(x * ANTIALIAS, y * ANTIALIAS) for x, y in points],
        fill=color,
    )
    return image.resize((ARROW_WIDTH, ARROW_HEIGHT), Image.Resampling.LANCZOS)


def main() -> None:
    project = Path(__file__).resolve().parents[1]
    assets = project / "assets"
    # ZeppPlayer reads the legacy root while the v2 packager requires assets
    # beneath the matching target name. Keep both deterministic copies.
    destinations = [assets / "glyphs", assets / "sb7" / "glyphs"]
    for destination in destinations:
        destination.mkdir(parents=True, exist_ok=True)
        for child in destination.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
        Image.new("RGBA", (ASSET_SIZE, ASSET_SIZE), (0, 0, 0, 0)).save(destination / "blank.png")

    preview = project / "preview_sb7.png"
    if preview.exists():
        shutil.copy2(preview, assets / "sb7" / preview.name)

    core, hole, arm_paths, bounds = geometry()
    generated = 1
    white_dirs = [destination / "white" for destination in destinations]
    for white_dir in white_dirs:
        white_dir.mkdir(parents=True, exist_ok=True)

    core_image = render_polygon(core, bounds, parse_color(RARITY_COLORS["white"], CORE_ALPHA), hole)
    for white_dir in white_dirs:
        core_image.save(white_dir / "core.png")
    generated += 1

    # Runtime image rotation places this canonical top-socket arm at all five
    # sockets and mirrors the complete lower glyph. Only seven digit images are
    # needed instead of five sockets x two orientations x six colors.
    canonical_digit_paths = arm_paths[0]
    for digit in range(1, 8):
        arm_image = render_polygon(
            canonical_digit_paths[digit],
            bounds,
            parse_color(RARITY_COLORS["white"]),
        )
        for white_dir in white_dirs:
            arm_image.save(white_dir / f"arm_{digit}.png")
        generated += 1

    for destination in destinations:
        arrow_dir = destination / "arrows"
        arrow_dir.mkdir(parents=True, exist_ok=True)
        for color_name, color_hex in RARITY_COLORS.items():
            for brightness, arrow_color in (
                ("bright", color_hex),
                ("dim", DIM_COLORS[color_name]),
            ):
                for direction in ("future", "past"):
                    render_arrow(parse_color(arrow_color), direction).save(
                        arrow_dir / f"{color_name}_{brightness}_{direction}.png"
                    )
    generated += len(RARITY_COLORS) * 2 * 2

    print(f"Generated {generated} glyph layers in each of: {', '.join(map(str, destinations))}")


if __name__ == "__main__":
    main()
