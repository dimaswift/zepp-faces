# Fractonica Zepp face

Solar Saros 141 harmonic clock using the fractonica.js model: ordinal zero is the first catalogue eclipse, position is piecewise linear between real eclipse times, a depth-N cycle (zero-based level N-1) spans `4 / P(N-1)` Saros units, and every cycle has the 16 two-stroke glyph states `0 1 2 3 4 3 2 1 0 -1 -2 -3 -4 -3 -2 -1`.

- Two teal glyphs show adjacent depths, the larger period on top. The default is depth 7 (about 5.05 h, 11 per depth-6 cycle) over depth 8 (about 33.7 min, 9 per depth-7 cycle).
- Tap the top third for one depth larger, the bottom third for one depth smaller. The range is depth 2/3 to depth 11/12, and the choice is remembered. After a change, the two period letters flash for 1.5 s at the left and right of the solar glyph: the top period on the left, the bottom period on the right. Depth 1 is α, depth 2 β, and so on; after ω the letters repeat with a suffix (α1, β1, ...).
- The derivative dot marks the second occurrence of each repeated glyph state (bins 5–8 and 13–15), so a cycle shows undotted states first and dotted ones later. The peak and valley (bins 4 and 12) have no dot.
- Each glyph has `n - 1` dots for its `n` sibling periods, placed like clock positions with the empty 12 o'clock slot standing for the first period. No lit dots means the first period, all lit means the last one.
- The yellow glyph in the middle is the solar reference. Nineteen depth-7 cycles are nearly four days. The first eclipse of Alpha 6 (1973-12-24 15:02 TT) is midnight zero, and every 19th depth-7 boundary after it is a sync midnight. The three yellow dots count the day since the last sync, and the glyph shows the phase of the current 86,400 s day measured from that sync midnight.
- With the catalogue intervals, 19 depth-7 cycles are 4 days minus about 10.02 s around 1973 and minus about 10.08 s in the current Saros interval, so each sync midnight lands about 10 s earlier than the exact 4-day grid. The fourth day is shortened by that amount. Tap the middle band (between the top and bottom tap zones) to show two labels for 4 s. Above the solar glyph, in teal, is the top glyph's next threshold (Peak, Node, Valley or End) with its local time, plus the date if it falls on another day. Below it, in yellow, is the local time of the current sync point. The anchor is the 1973-12-24 eclipse itself, so a full lap returns to that eclipse's time of day. The sync time is fixed for a whole 4-day sync and steps back by that sync's drift (-10.0224 s in 1973-1992, -10.0789 s in 2010-2028), and the first lap completes in February 2067. Double-tap the middle band to keep the period letters on screen; double-tap again to hide them. That setting is remembered.
- Local time uses the watch's own date and time from the TIME sensor, compared with UTC and rounded to 15 min. If those fields are implausible, as in ZeppPlayer's frozen simulated clock (2022-08-25 09:30:45), the JS time zone is used instead.
- Time is converted from UTC to TT as fractonica.js does: TT = UTC + 37 s + 32.184 s. Update `TT_MINUS_UTC_SECONDS` if a new leap second is announced.

Period letters are prerendered from Arial Unicode, because the band's system font may not include Greek. Glyph PNGs are fractonica's own `clock.glyphSVG` output, rasterised at 10 px per CBT unit with the library's 0.3-unit stroke (exactly 3 px). Grid lines fall on pixel centres, so straight strokes are fully opaque on whole pixels and only curves are anti-aliased. Images are drawn 1:1 and never scaled at runtime.

```sh
node tools/generate_assets.cjs   # needs rsvg-convert and magick; reads ../../fractonica-clock/fractonica.js
node --check watchface/index.js
node test/model.test.cjs         # cross-checks the Number port against fractonica.js BigInt maths
zeus build
```
