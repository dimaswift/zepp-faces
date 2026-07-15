#!/usr/bin/env python3
"""Extract active Saros past/next/next eclipse rows from Exeligmos data."""

from __future__ import annotations

import argparse
import bisect
import struct
from datetime import datetime, timezone
from pathlib import Path


def default_catalog() -> Path:
    projects = Path(__file__).resolve().parents[3]
    return projects / "exeligmos" / "SarosHarmonicJournal" / "Resources" / "SolarData"


def parse_anchor(value: str) -> int:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=default_catalog())
    parser.add_argument("--anchor", default="2026-07-15T00:00:00Z")
    args = parser.parse_args()

    times_data = (args.catalog / "eclipse_times.db").read_bytes()
    saros_data = (args.catalog / "saros.db").read_bytes()
    times = [item[0] for item in struct.iter_unpack("<q", times_data)]
    anchor = parse_anchor(args.anchor)
    rows: list[tuple[int, int, int, int]] = []

    for saros in range(1, 181):
        row_offset = (saros - 1) * 194
        count = saros_data[row_offset]
        indices = [
            struct.unpack_from("<H", saros_data, row_offset + 2 + position * 2)[0]
            for position in range(count)
        ]
        series_times = [times[index] for index in indices]
        if not series_times or not (series_times[0] < anchor < series_times[-1]):
            continue

        next_index = bisect.bisect_right(series_times, anchor)
        if next_index < 1 or next_index + 1 >= len(series_times):
            raise RuntimeError(f"Saros {saros} lacks a complete triplet at {args.anchor}")
        previous, following, second_following = series_times[next_index - 1 : next_index + 2]
        rows.append((saros, previous, following, second_following))

    if len(rows) != 40:
        raise RuntimeError(f"Expected 40 active series, found {len(rows)}")
    saros_numbers = [row[0] for row in rows]
    expected_numbers = list(range(saros_numbers[0], saros_numbers[0] + len(rows)))
    if saros_numbers != expected_numbers:
        raise RuntimeError("Active Saros rows are not contiguous")

    print(f"const FIRST_SAROS = {saros_numbers[0]}")
    print("const SAROS_ECLIPSE_SECONDS = [")
    for saros, previous, following, second_following in rows:
        print(f"    {previous}, {following}, {second_following}, // {saros}")
    print("]")


if __name__ == "__main__":
    main()
