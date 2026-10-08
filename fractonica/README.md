# Fractonica Zepp face

Solar Saros 141 harmonic clock using the fractonica.js model: ordinal zero is the first catalogue eclipse, position is piecewise linear between real eclipse times, a depth-N cycle (zero-based level N-1) spans `4 / P(N-1)` Saros units, and every cycle has the 16 two-stroke glyph states `0 1 2 3 4 3 2 1 0 -1 -2 -3 -4 -3 -2 -1`.

- Two teal glyphs show adjacent depths, the larger period on top. The default is depth 7 (about 5.05 h, 11 per depth-6 cycle) over depth 8 (about 33.7 min, 9 per depth-7 cycle).
- Tap the top third for one depth larger, the bottom third for one depth smaller. The range is depth 2/3 to depth 11/12, and the choice is remembered.
- Each glyph has `n - 1` dots for its `n` sibling periods, placed like clock positions with the empty 12 o'clock slot standing for the first period. No lit dots means the first period, all lit means the last one.
- The yellow glyph in the middle is the solar reference. Nineteen depth-7 cycles are nearly four days. The first eclipse of Alpha 6 (1973-12-24 15:02 TT) is midnight zero, and every 19th depth-7 boundary after it is a sync midnight. The three yellow dots count the day since the last sync, and the glyph shows the phase of the current 86,400 s day measured from that sync midnight.
- With the catalogue intervals, 19 depth-7 cycles are 4 days minus about 10.02 s around 1973 and minus about 10.08 s in the current Saros interval, so each sync midnight lands about 10 s earlier than the exact 4-day grid. The fourth day is shortened by that amount. Tap the middle band (between the top and bottom tap zones) to show, for 4 s, where the current sync midnight sits on the anchor day, as HH:MM:SS after the 1973 anchor midnight. The value is fixed for a whole 4-day sync and steps back by that sync's drift (-10.0224 s in 1973-1992, -10.0789 s in 2010-2028). The first full lap completes on 2067-02-13, 93.14 years after the anchor. The local clock and time zone are not used.
- Time is converted from UTC to TT as fractonica.js does: TT = UTC + 37 s + 32.184 s. Update `TT_MINUS_UTC_SECONDS` if a new leap second is announced.

Glyph PNGs are fractonica's own `clock.glyphSVG` output, rasterised at 10 px per CBT unit with the library's 0.3-unit stroke (exactly 3 px). Grid lines fall on pixel centres, so straight strokes are fully opaque on whole pixels and only curves are anti-aliased. Images are drawn 1:1 and never scaled at runtime.

```sh
node tools/generate_assets.cjs   # needs rsvg-convert and magick; reads ../../fractonica-clock/fractonica.js
node --check watchface/index.js
node test/model.test.cjs         # cross-checks the Number port against fractonica.js BigInt maths
zeus build
```
