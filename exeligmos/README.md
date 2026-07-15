# Exeligmos Zepp face

The face renders the current eclipse-anchored Saros phase as one ten-digit octal address split into two canonical five-arm Exeligmos glyphs.

- Default mode: Saros 141.
- Tap the bottom 20% of the screen to switch between the 40-series global Spike stream and Saros 141. The center 60% has no tap action.
- Saros 141 mode renders only the two glyphs in green; its middle label, directional triangle, and forecast dots are hidden.
- In global mode, the large centered label divides the two glyphs. An upward triangle means ascending toward the selected future Spike; a downward triangle means descending from the selected past Spike.
- A solid triangle points up toward a future Spike or down from a past Spike. Its pulse cadence interpolates from 4240 ms at the far edge of the selected Spike's active window to 66 ms at the Spike itself, alternating between bright and dim rarity colors while remaining fixed in place.
- The lower glyph is rotated 180 degrees as a mirrored counterpart to the upper glyph.
- Only Spikes with at least five trailing repdigits participate. Colors are white for 5, blue for 6, purple for 7, yellow for 8, and red for 9 or more.
- A blue Spike overrides up to `2^3` (8) raw Spikes before and after it, purple `2^4` (16), yellow `2^5` (32), and red `2^6` (64). Suppression is symmetric, but stops at the first Spike of equal or higher rarity; only strictly lower-rarity Spikes can be overridden.
- Four colored dots at the top show the next four raw Spike rarities in chronological order, including events that a higher-rarity Spike will override.
- Tap the top 20% to hide or show the global-mode forecast-dot row at y=28. Visibility is remembered, while Saros 141 mode always keeps the row hidden.
- Fixed mode shows the current Saros 141 phase directly. Global mode merges qualified events from all 40 series before applying the suppression rule.
- Runtime performance: green Saros 141 rendering bypasses Spike selection, global Spike state is retained across mode switches, and the exact near-term global glyph/triangle assets are prewarmed after the first fixed-mode frame.

The compact table holds one past and two future eclipse times for each of the 40 series active on 2026-07-15 (Saros 117 through 156). At the middle eclipse, the clock advances from the first interval to the second. All 40 rows have authoritative common coverage from 2026-02-17 through 2044-08-23; regenerate the snapshot rather than extrapolating eclipse times beyond it.

Regenerate the canonical PNG layers and verify the pure timing model with:

```sh
python3 tools/generate_glyph_assets.py
python3 tools/extract_saros_triplets.py
node --check watchface/index.js
node test/saros-model.test.cjs
zeus build
```

`extract_saros_triplets.py` reads the adjacent Exeligmos solar catalog by default; pass `--catalog` to use another copy.

The generator writes identical glyph layers to `assets/glyphs` for ZeppPlayer and `assets/sb7/glyphs` for the v2 Xiaomi Smart Band 7 package target, and syncs the target preview image.
