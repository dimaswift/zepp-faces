# Fractonica Zepp face

Solar Saros 141 harmonic clock using the fractonica.js model: ordinal zero is the first catalogue eclipse, position is piecewise linear between real eclipse times, and a depth-N cycle (zero-based level N-1) spans `4 / P(N-1)` Saros units.

## Journal face (default)

The face the fractonica-clock browser app shows by default (its `src/ui/face/journal.js`): the clock read the way the printed diary is addressed (SPEC §15).

- Minor units (ε η ι λ ν) in threes, every count in two digits so the reading never changes width: `34η 29ι 21λ`, `ε#05 34η 29ι`, `29ι 21λ 03ν` (the numbers white, the unit letters in the browser's level colours). Above them the lead unit's phase as a 2-stroke pair (256 states) with its letter; below them the same unit's cycle as two half-arcs, the left one below the axis (descending) and the right one above (ascending), with a dot at the present phase.
- A major period (α β γ δ) is shown alone: its phase as a big 3-stroke glyph (52 states), four lines of words in the middle (the ordinal of its current child, its name, its fracton word, its quarter: `5th / Delta / Trifracton / End` = the 5th Nuclide of Delta Trifracton, in its End quarter) and its own cycle below.
- Tap the top third for one unit longer, the bottom third for one unit shorter (α … ι λ ν); the unit is remembered. Triple-tap the middle to switch to the watch face below and back (remembered too).
- `journalAt(position, unit)` in `watchface/index.js` is the reading; `test/model.test.cjs` checks it against the browser's `journalReading` at 2 800 random readings. Its images (`j2_*`, `j3_*`, `jl_*`, `jc_*`, `jarc_*`, `jdot`) come from `tools/generate_journal_assets.cjs`, which `tools/generate_assets.cjs` runs too.

## Watch face

The layout below (period odometers and the solar sync), a triple tap away.

## Glyphs

A cycle with extreme value `m` has `4m` states: `0 … m`, then the falling branch `m-1 … -(m-1)` with a derivative dot, then `-m`, then `-(m-1) … -1`. Values match `clock.phaseAt`. The dot marks the falling branch, so each repeated value reads undotted rising and dotted falling.

- Two strokes (m = 4, 16 states): `0 1 2 3 4 3• 2• 1• 0• -1• -2• -3• -4 -3 -2 -1`
- Three strokes (m = 13, 52 states): `0 … 13, 12• … -12•, -13, -12 … -1`

## Layout

- Two teal periods show adjacent depths, the longer period at the top. The default is depth 7 (about 5.05 h, 11 per depth-6 cycle) over depth 8 (about 33.7 min, 9 per depth-7 cycle).
- Each period is a major/sub glyph pair, like an odometer: the major glyph (left) is the period's own 16-state phase, and the sub glyph (right) runs a full 16-state cycle inside each major state. At the defaults a sub state lasts about 71 s (depth 7) and 7.9 s (depth 8).
- Each period has one counter dot per sibling period, on an arc that follows the screen's rounded end: the top period along the top, the bottom period along the bottom. Dots are spread symmetrically and read left to right. Dots up to and including the current period are lit.
- Tap the top third for one depth larger, the bottom third for one depth smaller. The range is depth 2/3 to depth 11/12, and the choice is remembered. After a change, the period letters flash for 1.5 s, centred under the top glyph and above the bottom glyph. Depth 1 is α, depth 2 β, and so on; after ω the letters repeat with a suffix (α1, β1, ...). Double-tap the middle band to keep them on screen, and again to hide them; that setting is remembered.

## Solar reference

- Nineteen depth-7 cycles are nearly four days. The first eclipse of Alpha 6 (1973-12-24 15:01:59.816 UTC) is the zero sync point, and every 19th depth-7 boundary after it is the next sync.
- Three yellow two-stroke glyphs show the current sync period as an odometer. The left glyph steps through the period's 16 states (6 h each, so 4 states per day), the middle one runs a full cycle inside each left state (22.5 min per state), and the right one inside each middle state (84 s per state). All three restart exactly at a depth-7 boundary. `SOLAR_STROKES` and `SOLAR_DIGITS` in `watchface/index.js` switch to other arrangements, such as two three-stroke glyphs (52 states each); rerun the generator after changing them.
- With the catalogue intervals, 19 depth-7 cycles are 4 civil days minus about 10.03 s around 1973 and minus about 10.08 s in the current Saros interval. Each sync therefore lands about 10 s earlier on the clock, and the first full lap back to the 1973 eclipse's time of day completes on 2067-02-01.

## Tap info

Tap the middle band to show three labels for 4 s, in place of the period letters:

- Teal, above the solar glyphs: the top glyph's next threshold (Peak, Node, Valley or End).
- Yellow, below them: the sync period's next threshold. Its quarters are about one day each.
- Yellow, below that: the local time of the current sync point.

Times are local and show seconds, or the date instead when they fall on another day. Local time uses the watch's own date and time from the TIME sensor, compared with UTC and rounded to 15 min. If those fields are implausible, as in ZeppPlayer's frozen simulated clock (2022-08-25 09:30:45), the JS time zone is used instead.

## Time base

The face runs on device Unix time directly. The eclipse table in `watchface/index.js` is the Saros 141 catalogue precomputed in Unix seconds by fractonica.js (`F.defaults.unixTimestamps`): leap-second table 1972–2027, ΔT estimate before 1972, and TAI − UTC held at 37 s afterwards. There is no TT or leap-second logic on the watch. If a leap second is announced, regenerate the table with the library and paste it in. See `FRACTONICA_CLOCK_SPEC.md` in `fractonica-clock` for the full definition.

## Assets

Two-stroke glyphs are fractonica's `clock.glyphSVG` strokes and three-stroke glyphs are its `CBT.fromScalar(value, {depth: 3})` strokes. They are rasterised at 10 px per CBT unit with the library's 0.3-unit stroke (exactly 3 px). Grid lines fall on pixel centres, so straight strokes are fully opaque on whole pixels and only curves are anti-aliased. Images are drawn 1:1 and never scaled at runtime. Period letters are prerendered from Arial Unicode, because the band's system font may not include Greek.

```sh
node tools/generate_assets.cjs   # needs rsvg-convert and magick; reads ../../fractonica-clock/fractonica-2.0.0.js
node tools/generate_journal_assets.cjs   # only the journal face's images (leaves the rest of fx/ alone)
node --check watchface/index.js
node test/model.test.cjs         # cross-checks the Number port against the fractonica.js Unix clock
zeus build
```
