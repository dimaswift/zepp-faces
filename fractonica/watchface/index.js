(() => {
    'use strict'

    // Fractonica harmonic clock on Solar Saros 141, ported from fractonica.js
    // to plain Numbers. Ordinal zero is the first catalogue eclipse; position
    // is piecewise linear between actual eclipse timestamps. A level-L cycle
    // spans 4 / P(L) Saros units and has 16 glyph bins. Depth N is level N - 1.
    const SEQUENCE = [5, 13, 5, 5, 7, 11, 9, 4]
    const BINS_PER_CYCLE = 16
    // Period names by depth: depth 1 is alpha. After omega the alphabet
    // repeats with a numeric suffix (alpha1, beta1, ...).
    const GREEK = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ',
        'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω']
    // Quarter boundaries of a cycle, as in clock.period() events.
    const THRESHOLD_NAMES = ['Peak', 'Node', 'Valley', 'End']
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Solar Saros 141 greatest eclipses, TT seconds since 1970-01-01 TT
    // (fractonica.js DEFAULT_ECLIPSES). Index = recurrence ordinal.
    const ECLIPSES_TT = [
        -11253795384, -10684827263, -10115859443, -9546891833, -8977924433,
        -8408957006, -7839989585, -7271021944, -6702054195, -6133086020,
        -5564117556, -4995148575, -4426179187, -3857209177, -3288238726,
        -2719267746, -2150296299, -1581324348, -1012352055, -443379455,
        125593364, 694566337, 1263539259, 1832512139, 2401484786,
        2970457223, 3539429220, 4108400891, 4677372055, 5246342779,
        5815312981, 6384282795, 6953252190, 7522221186, 8091189911,
        8660158392, 9229126755, 9798095001, 10367063342, 10936031778,
        11505000393, 12073969295, 12642938541, 13211908225, 13780878323,
        14349848986, 14918820180, 15487791957, 16056764302, 16625737223,
        17194710682, 17763684566, 18332658941, 18901633621, 19470608606,
        20039583666, 20608558884, 21177534004, 21746509035, 22315483795,
        22884458336, 23453432492, 24022406294, 24591379667, 25160352680,
        25729325224, 26298297440, 26867269261, 27436240877, 28005212105
    ]

    // TT - UTC = (TAI - UTC) + 32.184 s. TAI - UTC has been 37 s since
    // 2017-01-01; update if a new leap second is announced.
    const TT_MINUS_UTC_SECONDS = 37 + 32.184


    // Solar reference. 19 depth-7 cycles (~5.05 h each) are almost exactly
    // four days. The first eclipse of Alpha 6 (ordinal 20, 1973-12-24) is
    // the zero sync point; every 19th depth-7 boundary after it is the next
    // sync. Each sync lands 19 * T7 - 4 * 86400 seconds away from the exact
    // 4-day grid, and that offset accumulates (about -10.06 s per sync with
    // the catalogue intervals: the depth-7 grid runs slightly short).
    const SOLAR_LEVEL = 6
    const SOLAR_ANCHOR_ORDINAL = 20
    const SOLAR_CYCLES_PER_SYNC = 19
    const SOLAR_DAYS_PER_SYNC = 4
    const DAY_SECONDS = 86400
    // The sync period is shown as an odometer of SOLAR_DIGITS glyphs with
    // SOLAR_STROKES strokes each: the left glyph steps through the states of
    // the whole period, and each glyph to its right runs a full cycle inside
    // one state of its left neighbour. A glyph of s strokes has extreme value
    // m = (3^s - 1) / 2 and 4m states (16 for two strokes, 52 for three).
    // Three two-stroke glyphs: 6 h, 22.5 min and 84 s per state.
    const SOLAR_STROKES = 2
    const SOLAR_DIGITS = 3
    const SOLAR_EXTREME = (Math.pow(3, SOLAR_STROKES) - 1) / 2
    const SOLAR_STATES = 4 * SOLAR_EXTREME

    const MIN_TOP_DEPTH = 2
    const MAX_TOP_DEPTH = 11
    const DEFAULT_TOP_DEPTH = 7
    const DEPTH_STORAGE_KEY = 'fractonica_top_depth'

    // Glyph images: 10 px per CBT unit; the stem (x = 0) is on the pixel
    // column centre GLYPH_STEM_X, and the drawing's vertical centre on row
    // *_CENTER_Y (2.05 units for two strokes, 3.475 for three).
    const GLYPH_W = 53
    const GLYPH_STEM_X = 26
    const GLYPH2_H = 90
    const GLYPH2_CENTER_Y = 45
    const GLYPH3_H = 120
    const GLYPH3_CENTER_Y = 59
    // Each period is a major/sub glyph pair. Strokes reach 2.15 units
    // (21.5 px) either side of a stem, so stems 80 px apart leave a 37 px gap.
    const PAIR_STEM_SPACING = 80
    // Three solar glyphs fit the 192 px width only up to about 64 px apart.
    const SOLAR_STEM_SPACING = { 2: 80, 3: 64 }[SOLAR_DIGITS]
    const PERIOD_GLYPH_OFFSET = 165
    const LETTER_OFFSET = 90
    const DOT_SIZE = 7
    // Period counters sit on arcs concentric with the screen's rounded ends.
    const ARC_INSET = 10
    const ARC_STEP_DEGREES = 11.5
    const MAX_ARC_DOTS = 13
    const LABEL_HEIGHT = 20
    const SOLAR_COLOR = 0xFFD60A
    const PERIOD_COLOR = 0x4FD1C5
    const INFO_MILLISECONDS = 4000
    const LETTER_MILLISECONDS = 1500
    const DOUBLE_TAP_MILLISECONDS = 400
    const LETTERS_STORAGE_KEY = 'fractonica_letters'
    const LETTERS_STORED_ON = 1
    const LETTERS_STORED_OFF = 2
    const LETTER_W = 20
    const LETTER_H = 28
    const SUB_W = 9
    const SUB_H = 14
    const TOUCH_ZONE_FRACTION = 1 / 3
    const MIN_TICK_MILLISECONDS = 50
    const MAX_TICK_MILLISECONDS = 1000

    const prefixes = [1]
    function prefix(level) {
        while (prefixes.length <= level) {
            const n = prefixes.length
            prefixes.push(prefixes[n - 1] * SEQUENCE[(n - 1) % SEQUENCE.length])
        }
        return prefixes[level]
    }

    // Number of level-L cycles inside one level-(L-1) cycle.
    function siblingCount(level) {
        return SEQUENCE[(level - 1) % SEQUENCE.length]
    }

    function ttFromUtcMilliseconds(utcMilliseconds) {
        return utcMilliseconds / 1000 + TT_MINUS_UTC_SECONDS
    }

    function positiveModulo(value, modulus) {
        const remainder = value % modulus
        return remainder >= 0 ? remainder : remainder + modulus
    }

    // Position split into whole ordinal and fraction to keep precision when
    // multiplied by large prefixes.
    function positionAt(tt) {
        const last = ECLIPSES_TT.length - 1
        if (tt < ECLIPSES_TT[0] || tt > ECLIPSES_TT[last]) {
            return null
        }
        let lo = 0
        let hi = last
        while (lo + 1 < hi) {
            const mid = (lo + hi) >> 1
            if (ECLIPSES_TT[mid] <= tt) {
                lo = mid
            } else {
                hi = mid
            }
        }
        return {
            ordinal: lo,
            fraction: (tt - ECLIPSES_TT[lo]) / (ECLIPSES_TT[lo + 1] - ECLIPSES_TT[lo])
        }
    }

    // Inverse of positionAt for a position given as numerator / denominator.
    function timestampAtRational(numerator, denominator) {
        const ordinal = Math.min(Math.floor(numerator / denominator), ECLIPSES_TT.length - 2)
        const fraction = (numerator - ordinal * denominator) / denominator
        return ECLIPSES_TT[ordinal] + fraction * (ECLIPSES_TT[ordinal + 1] - ECLIPSES_TT[ordinal])
    }

    function wholeBins(position, level) {
        const units = prefix(level) * 4
        return position.ordinal * units + Math.floor(position.fraction * units)
    }

    // Same quantisation as clock.phaseAt: index = floor(position * P * 4)
    // mod 16 (ascending family). `local` is this cycle's index inside its
    // parent: 0 for the first period, siblings - 1 for the last.
    function phaseAt(position, level) {
        const bins = wholeBins(position, level)
        const cycle = Math.floor(bins / BINS_PER_CYCLE)
        const siblings = siblingCount(level)
        return {
            level: level,
            index: positiveModulo(bins, BINS_PER_CYCLE),
            cycle: cycle,
            local: positiveModulo(cycle, siblings),
            siblings: siblings
        }
    }

    // The sub glyph runs one full 16-state cycle inside each major bin: its
    // state is the bin index at 16x the major resolution.
    function subPhaseAt(position, level) {
        const units = prefix(level) * 4 * BINS_PER_CYCLE
        const fine = position.ordinal * units + Math.floor(position.fraction * units)
        return { sub: positiveModulo(fine, BINS_PER_CYCLE) }
    }

    // Glyph state for bin `index` of a cycle whose extreme value is `m`
    // (4 for two strokes, 13 for three): 0 .. m, then the falling branch
    // m-1 .. -(m-1) dotted, then -m, then -(m-1) .. -1. Same values as
    // clock.phaseAt; the dot marks the falling branch so repeated values
    // read undotted rising, dotted falling.
    function glyphState(index, m) {
        if (index <= m) {
            return { value: index, dotted: false }
        }
        if (index < 3 * m) {
            return { value: 2 * m - index, dotted: true }
        }
        return { value: index - 4 * m, dotted: false }
    }

    function solarAt(tt) {
        const position = positionAt(tt)
        if (position === null) {
            return null
        }
        const level = SOLAR_LEVEL
        const p = prefix(level)
        // Level-6 cycle index of the anchor eclipse: 20 * P(6) / 4.
        const anchorCycle = SOLAR_ANCHOR_ORDINAL * p / 4
        const cycle = Math.floor(wholeBins(position, level) / BINS_PER_CYCLE)
        const sync = Math.floor((cycle - anchorCycle) / SOLAR_CYCLES_PER_SYNC)
        // Sync boundary position = (anchorCycle + 19 * sync) * 4 / P(6).
        const syncStart = timestampAtRational((anchorCycle + SOLAR_CYCLES_PER_SYNC * sync) * 4, p)
        const syncEnd = timestampAtRational((anchorCycle + SOLAR_CYCLES_PER_SYNC * (sync + 1)) * 4, p)
        const nominalStart = ECLIPSES_TT[SOLAR_ANCHOR_ORDINAL]
            + sync * SOLAR_DAYS_PER_SYNC * DAY_SECONDS
        const phase = (tt - syncStart) / (syncEnd - syncStart)
        const steps = Math.pow(SOLAR_STATES, SOLAR_DIGITS)
        let step = Math.min(Math.max(Math.floor(phase * steps), 0), steps - 1)
        const digits = []
        for (let i = 0; i < SOLAR_DIGITS; i++) {
            digits.unshift(step % SOLAR_STATES)
            step = Math.floor(step / SOLAR_STATES)
        }
        return {
            sync: sync,
            syncStart: syncStart,
            syncEnd: syncEnd,
            drift: syncStart - nominalStart,
            phase: phase,
            // Glyph states, left (whole period) to right (finest).
            digits: digits
        }
    }

    // Next quarter boundary of the sync period (each quarter is ~1 day).
    function solarThreshold(solar) {
        const quarter = Math.min(Math.floor(solar.phase * 4), 3)
        return {
            name: THRESHOLD_NAMES[quarter],
            tt: solar.syncStart + (quarter + 1) / 4 * (solar.syncEnd - solar.syncStart)
        }
    }

    // Next quarter boundary (peak, node, valley or end) of the current cycle
    // at `level`, as a TT timestamp.
    function nextThreshold(position, level) {
        const units = prefix(level) * 4
        const bins = position.ordinal * units + Math.floor(position.fraction * units)
        const index = positiveModulo(bins, BINS_PER_CYCLE)
        const quarter = Math.floor(index / 4)
        const boundary = bins - index + 4 * (quarter + 1)
        return { name: THRESHOLD_NAMES[quarter], tt: timestampAtRational(boundary, units) }
    }

    function periodName(depth) {
        const cycle = Math.floor((depth - 1) / GREEK.length)
        return { letter: (depth - 1) % GREEK.length, suffix: cycle > 0 ? String(cycle) : '' }
    }

    // UTC offset of the watch's wall clock: its local date/time fields minus
    // UTC, rounded to 15 min. If the fields are implausible (more than 14 h
    // away, e.g. a simulator's frozen clock), use `fallbackSeconds`.
    function utcOffsetSeconds(utcMilliseconds, local, fallbackSeconds) {
        if (local && local.year > 0) {
            const wall = Date.UTC(local.year, local.month - 1, local.day,
                local.hour, local.minute, local.second) / 1000
            const offset = Math.round((wall - utcMilliseconds / 1000) / 900) * 900
            if (Math.abs(offset) <= 14 * 3600) {
                return offset
            }
        }
        return fallbackSeconds
    }

    const pad2 = (n) => (n < 10 ? '0' : '') + n

    function wallClock(utcSeconds, offsetSeconds) {
        const local = Math.round(utcSeconds + offsetSeconds)
        const days = Math.floor(local / DAY_SECONDS)
        const seconds = local - days * DAY_SECONDS
        // Civil date from days since 1970-01-01 (proleptic Gregorian).
        const z = days + 719468
        const era = Math.floor(z / 146097)
        const doe = z - era * 146097
        const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
        const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
        const mp = Math.floor((5 * doy + 2) / 153)
        const month = mp < 10 ? mp + 3 : mp - 9
        return {
            days: days,
            year: yoe + era * 400 + (month <= 2 ? 1 : 0),
            month: month,
            day: doy - Math.floor((153 * mp + 2) / 5) + 1,
            time: pad2(Math.floor(seconds / 3600)) + ':' + pad2(Math.floor(seconds / 60) % 60) + ':' + pad2(seconds % 60)
        }
    }

    // Local wall-clock time of the current sync point. The anchor is the
    // 1973-12-24 eclipse itself, so one lap is a return to its time of day.
    function syncClockText(syncStartTT, offsetSeconds) {
        return wallClock(syncStartTT - TT_MINUS_UTC_SECONDS, offsetSeconds).time
    }

    // "Peak 14:32:05" on today's date, otherwise "Peak Oct 10 14:32".
    function thresholdText(threshold, nowUtcSeconds, offsetSeconds) {
        const at = wallClock(threshold.tt - TT_MINUS_UTC_SECONDS, offsetSeconds)
        const today = wallClock(nowUtcSeconds, offsetSeconds)
        if (at.days === today.days) {
            return threshold.name + ' ' + at.time
        }
        return threshold.name + ' ' + MONTHS[at.month - 1] + ' ' + at.day + ' ' + at.time.slice(0, 5)
    }

    function clampTopDepth(depth) {
        return Math.min(Math.max(depth, MIN_TOP_DEPTH), MAX_TOP_DEPTH)
    }

    // Refresh several times per sub glyph state of the finer displayed level.
    function tickMilliseconds(level) {
        const sarosSeconds = ECLIPSES_TT[23] - ECLIPSES_TT[22]
        const binMilliseconds = 4 * sarosSeconds * 1000 / prefix(level) / BINS_PER_CYCLE / BINS_PER_CYCLE
        return Math.min(Math.max(Math.floor(binMilliseconds / 8), MIN_TICK_MILLISECONDS), MAX_TICK_MILLISECONDS)
    }

    // n counter dots on the arc, spread symmetrically about its centre line,
    // left to right. Dot k stands for period k of the parent.
    function arcDotCenters(arc, n) {
        const centers = []
        for (let k = 0; k < n; k++) {
            const angle = (k - (n - 1) / 2) * ARC_STEP_DEGREES * Math.PI / 180
            centers.push({
                x: Math.round(arc.cx + arc.radius * Math.sin(angle)),
                y: Math.round(arc.cy + arc.dir * arc.radius * Math.cos(angle))
            })
        }
        return centers
    }

    // Screen layout. The band is a pill: its rounded ends are semicircles of
    // radius width / 2, and the counter arcs sit ARC_INSET inside them.
    function layoutFor(width, height) {
        const cx = Math.floor(width / 2)
        const cy = Math.floor(height / 2)
        const radius = cx - ARC_INSET
        // A centred row of glyphs, stems `spacing` apart.
        const row = (centerY, count, spacing, glyphCenterY) => Array.from({ length: count }, (_, i) => ({
            x: cx + Math.round((i - (count - 1) / 2) * spacing) - GLYPH_STEM_X,
            y: centerY - glyphCenterY
        }))
        // Major glyph left, sub glyph right.
        const pair = (centerY, glyphCenterY) => row(centerY, 2, PAIR_STEM_SPACING, glyphCenterY)
        return {
            cx: cx,
            cy: cy,
            periodGlyphs: [
                pair(cy - PERIOD_GLYPH_OFFSET, GLYPH2_CENTER_Y),
                pair(cy + PERIOD_GLYPH_OFFSET, GLYPH2_CENTER_Y)
            ],
            solarGlyphs: row(cy, SOLAR_DIGITS, SOLAR_STEM_SPACING,
                SOLAR_STROKES === 3 ? GLYPH3_CENTER_Y : GLYPH2_CENTER_Y),
            arcs: [
                { cx: cx, cy: cx, radius: radius, dir: -1 },
                { cx: cx, cy: height - cx, radius: radius, dir: 1 }
            ],
            // Letters and info labels share the gaps above and below the
            // solar glyphs; the labels replace the letters while shown.
            letters: [{ x: cx, y: cy - LETTER_OFFSET }, { x: cx, y: cy + LETTER_OFFSET }],
            labels: {
                period: cy - LETTER_OFFSET - (LABEL_HEIGHT >> 1),
                solar: cy + LETTER_OFFSET - LABEL_HEIGHT - 1,
                sync: cy + LETTER_OFFSET + 1
            }
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            SEQUENCE,
            ECLIPSES_TT,
            TT_MINUS_UTC_SECONDS,
            SOLAR_LEVEL,
            SOLAR_ANCHOR_ORDINAL,
            SOLAR_CYCLES_PER_SYNC,
            SOLAR_STROKES,
            SOLAR_DIGITS,
            SOLAR_EXTREME,
            SOLAR_STATES,
            DEFAULT_TOP_DEPTH,
            MIN_TOP_DEPTH,
            MAX_TOP_DEPTH,
            GREEK,
            DOT_SIZE,
            prefix,
            siblingCount,
            ttFromUtcMilliseconds,
            positionAt,
            timestampAtRational,
            phaseAt,
            glyphState,
            subPhaseAt,
            solarAt,
            solarThreshold,
            nextThreshold,
            periodName,
            utcOffsetSeconds,
            wallClock,
            syncClockText,
            thresholdText,
            clampTopDepth,
            tickMilliseconds,
            arcDotCenters,
            layoutFor
        }
    }

    if (typeof DeviceRuntimeCore === 'undefined') {
        return
    }

    let time = null
    let timerId = null
    let topDepth = DEFAULT_TOP_DEPTH
    let screenWidth = 0
    let screenHeight = 0
    let layout = null
    let periods = []
    let solarGlyphs = []
    let periodThresholdLabel = null
    let solarThresholdLabel = null
    let syncLabel = null
    let infoHideAt = 0
    let letterSlots = []
    let lettersPersistent = false
    let lettersHideAt = 0
    let lastMiddleTapAt = 0

    function asset(name) {
        return 'fx/' + name + '.png'
    }

    function image(x, y, w, h, src) {
        return hmUI.createWidget(hmUI.widget.IMG, { x: x, y: y, w: w, h: h, src: src })
    }

    function setSource(holder, source) {
        if (holder.source !== source) {
            holder.widget.setProperty(hmUI.prop.SRC, source)
            holder.source = source
        }
    }

    function createPeriod(i) {
        const dots = []
        for (let k = 0; k < MAX_ARC_DOTS; k++) {
            dots.push({ widget: image(0, 0, DOT_SIZE, DOT_SIZE, asset('teal_dot_off')), source: '' })
            dots[k].widget.setProperty(hmUI.prop.VISIBLE, false)
        }
        return {
            arc: layout.arcs[i],
            glyphs: layout.periodGlyphs[i].map((at) =>
                ({ widget: image(at.x, at.y, GLYPH_W, GLYPH2_H, asset('teal_0')), source: '' })),
            dots: dots,
            siblings: 0
        }
    }

    function layoutPeriod(period, siblings) {
        if (period.siblings === siblings) {
            return
        }
        const centers = arcDotCenters(period.arc, siblings)
        for (let k = 0; k < period.dots.length; k++) {
            const visible = k < centers.length
            if (visible) {
                period.dots[k].widget.setProperty(hmUI.prop.MORE, {
                    x: centers[k].x - (DOT_SIZE >> 1),
                    y: centers[k].y - (DOT_SIZE >> 1),
                    w: DOT_SIZE,
                    h: DOT_SIZE
                })
            }
            period.dots[k].widget.setProperty(hmUI.prop.VISIBLE, visible)
        }
        period.siblings = siblings
    }

    // Dots up to and including the current period are lit.
    function drawPeriod(period, phase, sub) {
        setSource(period.glyphs[0], asset('teal_' + phase.index))
        setSource(period.glyphs[1], asset('teal_' + sub.sub))
        for (let k = 0; k < period.siblings; k++) {
            setSource(period.dots[k], asset(k <= phase.local ? 'teal_dot_on' : 'teal_dot_off'))
        }
    }

    function tick() {
        if (!time || !time.utc) {
            return
        }
        const tt = ttFromUtcMilliseconds(time.utc)
        const position = positionAt(tt)
        if (position === null) {
            return
        }
        for (let i = 0; i < periods.length; i++) {
            const level = topDepth - 1 + i
            const phase = phaseAt(position, level)
            layoutPeriod(periods[i], phase.siblings)
            drawPeriod(periods[i], phase, subPhaseAt(position, level))
        }
        const solar = solarAt(tt)
        for (let i = 0; i < solarGlyphs.length; i++) {
            setSource(solarGlyphs[i], asset('sun_' + solar.digits[i]))
        }
        if (infoHideAt) {
            if (time.utc >= infoHideAt) {
                hideInfo()
            } else {
                drawInfo(position, solar)
            }
        }
        if (lettersHideAt && time.utc >= lettersHideAt) {
            lettersHideAt = 0
            refreshLetters()
        }
    }

    function localOffsetSeconds() {
        let fallback = 0
        try {
            const minutes = new Date(time.utc).getTimezoneOffset()
            fallback = isFinite(minutes) ? -minutes * 60 : 0
        } catch (e) {
            fallback = 0
        }
        return utcOffsetSeconds(time.utc, time, fallback)
    }

    function drawInfo(position, solar) {
        const offset = localOffsetSeconds()
        const now = time.utc / 1000
        periodThresholdLabel.setProperty(hmUI.prop.TEXT,
            thresholdText(nextThreshold(position, topDepth - 1), now, offset))
        solarThresholdLabel.setProperty(hmUI.prop.TEXT, thresholdText(solarThreshold(solar), now, offset))
        syncLabel.setProperty(hmUI.prop.TEXT, syncClockText(solar.syncStart, offset))
    }

    function setInfoVisible(visible) {
        periodThresholdLabel.setProperty(hmUI.prop.VISIBLE, visible)
        solarThresholdLabel.setProperty(hmUI.prop.VISIBLE, visible)
        syncLabel.setProperty(hmUI.prop.VISIBLE, visible)
    }

    function showInfo() {
        const tt = ttFromUtcMilliseconds(time.utc)
        const position = positionAt(tt)
        if (position === null) {
            return
        }
        drawInfo(position, solarAt(tt))
        infoHideAt = time.utc + INFO_MILLISECONDS
        setInfoVisible(true)
        refreshLetters()
    }

    function hideInfo() {
        infoHideAt = 0
        setInfoVisible(false)
        refreshLetters()
    }

    // Single tap: thresholds and sync time for a few seconds.
    // Double tap: toggles persistent period letters.
    function onMiddleTap() {
        if (!time || !time.utc) {
            return
        }
        const now = time.utc
        if (lastMiddleTapAt && now - lastMiddleTapAt < DOUBLE_TAP_MILLISECONDS) {
            lastMiddleTapAt = 0
            lettersPersistent = !lettersPersistent
            hmFS.SysProSetInt(LETTERS_STORAGE_KEY, lettersPersistent ? LETTERS_STORED_ON : LETTERS_STORED_OFF)
            lettersHideAt = 0
            hideInfo()
            return
        }
        lastMiddleTapAt = now
        showInfo()
    }

    function createLetterSlot(center) {
        return {
            center: center,
            letter: image(center.x, center.y, LETTER_W, LETTER_H, asset('greek_0')),
            subs: [
                image(center.x, center.y, SUB_W, SUB_H, asset('sub_0')),
                image(center.x, center.y, SUB_W, SUB_H, asset('sub_0'))
            ],
            suffix: ''
        }
    }

    function layoutLetterSlot(slot, depth) {
        const name = periodName(depth)
        const width = LETTER_W + name.suffix.length * SUB_W
        const left = slot.center.x - Math.floor(width / 2)
        const top = slot.center.y - (LETTER_H >> 1)
        slot.letter.setProperty(hmUI.prop.MORE, { x: left, y: top, w: LETTER_W, h: LETTER_H, src: asset('greek_' + name.letter) })
        for (let i = 0; i < slot.subs.length; i++) {
            if (i < name.suffix.length) {
                slot.subs[i].setProperty(hmUI.prop.MORE, {
                    x: left + LETTER_W + i * SUB_W,
                    y: top + LETTER_H - SUB_H,
                    w: SUB_W,
                    h: SUB_H,
                    src: asset('sub_' + name.suffix.charAt(i))
                })
            }
        }
        slot.suffix = name.suffix
    }

    // Letters show while persistent or briefly after a depth change, and
    // give way to the info labels, which use the same gaps.
    function refreshLetters() {
        const visible = !infoHideAt && (lettersPersistent || lettersHideAt > 0)
        for (let i = 0; i < letterSlots.length; i++) {
            const slot = letterSlots[i]
            slot.letter.setProperty(hmUI.prop.VISIBLE, visible)
            for (let k = 0; k < slot.subs.length; k++) {
                slot.subs[k].setProperty(hmUI.prop.VISIBLE, visible && k < slot.suffix.length)
            }
        }
    }

    // Top: the longer period, under the top glyph; bottom: the shorter one.
    function updateLetters() {
        layoutLetterSlot(letterSlots[0], topDepth)
        layoutLetterSlot(letterSlots[1], topDepth + 1)
    }

    function restartTickTimer() {
        if (timerId) {
            timer.stopTimer(timerId)
        }
        timerId = timer.createTimer(0, tickMilliseconds(topDepth), () => tick(), {})
    }

    function setTopDepth(depth) {
        const next = clampTopDepth(depth)
        if (next === topDepth) {
            return
        }
        topDepth = next
        hmFS.SysProSetInt(DEPTH_STORAGE_KEY, topDepth)
        updateLetters()
        lettersHideAt = lettersPersistent ? 0 : time.utc + LETTER_MILLISECONDS
        if (infoHideAt) {
            hideInfo()
        } else {
            refreshLetters()
        }
        tick()
        restartTickTimer()
    }

    function createTapZone(y, h, onTap) {
        const zone = hmUI.createWidget(hmUI.widget.IMG, {
            x: 0,
            y: y,
            w: screenWidth,
            h: h,
            alpha: 0,
            src: asset('blank')
        })
        zone.addEventListener(hmUI.event.CLICK_DOWN, onTap)
        return zone
    }

    function build() {
        const deviceInfo = hmSetting.getDeviceInfo()
        screenWidth = deviceInfo.width
        screenHeight = deviceInfo.height
        layout = layoutFor(screenWidth, screenHeight)
        time = hmSensor.createSensor(hmSensor.id.TIME)
        const storedDepth = hmFS.SysProGetInt(DEPTH_STORAGE_KEY)
        topDepth = storedDepth ? clampTopDepth(storedDepth) : DEFAULT_TOP_DEPTH
        lettersPersistent = hmFS.SysProGetInt(LETTERS_STORAGE_KEY) === LETTERS_STORED_ON

        periods = [createPeriod(0), createPeriod(1)]
        solarGlyphs = layout.solarGlyphs.map((at) =>
            ({ widget: image(at.x, at.y, GLYPH_W, SOLAR_STROKES === 3 ? GLYPH3_H : GLYPH2_H, asset('sun_0')), source: '' }))

        const label = (y, color) => hmUI.createWidget(hmUI.widget.TEXT, {
            x: 0,
            y: y,
            w: screenWidth,
            h: LABEL_HEIGHT,
            color: color,
            text_size: 16,
            align_h: hmUI.align.CENTER_H,
            align_v: hmUI.align.CENTER_V,
            text_style: hmUI.text_style.NONE,
            text: ''
        })
        // On tap: the top glyph's next threshold above the solar glyphs; the
        // solar period's next threshold and the sync time below them.
        periodThresholdLabel = label(layout.labels.period, PERIOD_COLOR)
        solarThresholdLabel = label(layout.labels.solar, SOLAR_COLOR)
        syncLabel = label(layout.labels.sync, SOLAR_COLOR)
        setInfoVisible(false)

        letterSlots = layout.letters.map(createLetterSlot)
        updateLetters()
        refreshLetters()

        const zoneHeight = Math.floor(screenHeight * TOUCH_ZONE_FRACTION)
        createTapZone(0, zoneHeight, () => setTopDepth(topDepth - 1))
        createTapZone(screenHeight - zoneHeight, zoneHeight, () => setTopDepth(topDepth + 1))
        createTapZone(zoneHeight, screenHeight - 2 * zoneHeight, onMiddleTap)

        tick()
        restartTickTimer()
    }

    var __$$app$$__ = __$$hmAppManager$$__.currentApp
    var __$$module$$__ = __$$app$$__.current
    __$$module$$__.module = DeviceRuntimeCore.WatchFace({
        onInit() {
            build()
        },
        onDestroy() {
            if (timerId) {
                timer.stopTimer(timerId)
                timerId = null
            }
        }
    })
})()
