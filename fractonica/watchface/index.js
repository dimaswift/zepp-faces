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
    // the zero "midnight"; every 19th depth-7 boundary after it is a sync
    // midnight. Each sync lands 19 * T7 - 4 * 86400 seconds away from the
    // exact 4-day grid, and that offset accumulates (≈ -10.06 s per sync
    // with the catalogue intervals: the depth-7 grid runs slightly short).
    const SOLAR_LEVEL = 6
    const SOLAR_ANCHOR_ORDINAL = 20
    const SOLAR_CYCLES_PER_SYNC = 19
    const SOLAR_DAYS_PER_SYNC = 4
    const DAY_SECONDS = 86400

    const MIN_TOP_DEPTH = 2
    const MAX_TOP_DEPTH = 11
    const DEFAULT_TOP_DEPTH = 7
    const DEPTH_STORAGE_KEY = 'fractonica_top_depth'

    const GLYPH_W = 53
    const GLYPH_H = 90
    // Glyph x = 0 (the stem) sits at this pixel column centre, and the
    // vertical centre of the CBT drawing (y = 2.05 units) at this row.
    const GLYPH_STEM_X = 26
    const GLYPH_CENTER_Y = 45
    const DOT_SIZE = 7
    const RING_RADIUS = 60
    const RING_SPACING = 155
    const MAX_RING_DOTS = 12
    const LABEL_HEIGHT = 20
    const SYNC_COLOR = 0xFFD60A
    const THRESHOLD_COLOR = 0x4FD1C5
    // Info labels above and below the solar glyph; the lower one clears the
    // bottom day dot.
    const INFO_LABEL_OFFSET = 65
    const SYNC_LABEL_OFFSET = 68
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
    // Glyph strokes reach at most 2.15 units (21.5 px) either side of the
    // stem; letters sit midway between that reach and the screen edge.
    const GLYPH_HALF_REACH = 21.5
    // Solar day dots, clockwise from the right (day 2, 3, 4), relative to
    // the glyph centre. Side dots sit level with the lower crossbar (CBT
    // y = 3, pixel row centre + 9); the bottom one mirrors the glyph's own
    // derivative dot: 1.75 units past the stem end (y = 7.75, centre + 57).
    const SOLAR_DOT_OFFSETS = [{ x: 33, y: 9 }, { x: 0, y: 57 }, { x: -33, y: 9 }]
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
        const nominalStart = ECLIPSES_TT[SOLAR_ANCHOR_ORDINAL]
            + sync * SOLAR_DAYS_PER_SYNC * DAY_SECONDS
        const elapsed = tt - syncStart
        const day = Math.min(Math.max(Math.floor(elapsed / DAY_SECONDS), 0), SOLAR_DAYS_PER_SYNC - 1)
        const dayPhase = (elapsed - day * DAY_SECONDS) / DAY_SECONDS
        return {
            sync: sync,
            syncStart: syncStart,
            drift: syncStart - nominalStart,
            day: day,
            index: Math.min(Math.max(Math.floor(dayPhase * BINS_PER_CYCLE), 0), BINS_PER_CYCLE - 1)
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

    // Refresh several times per glyph bin of the finer displayed level.
    function tickMilliseconds(level) {
        const sarosSeconds = ECLIPSES_TT[23] - ECLIPSES_TT[22]
        const binMilliseconds = 4 * sarosSeconds * 1000 / prefix(level) / BINS_PER_CYCLE
        return Math.min(Math.max(Math.floor(binMilliseconds / 8), MIN_TICK_MILLISECONDS), MAX_TICK_MILLISECONDS)
    }

    // Dot k (0-based) of n - 1 sits at clock angle 360 * (k + 1) / n; the
    // empty 12 o'clock slot is the first period of the parent.
    function ringDotCenters(cx, cy, siblings) {
        const centers = []
        for (let k = 0; k < siblings - 1; k++) {
            const angle = 2 * Math.PI * (k + 1) / siblings
            centers.push({
                x: Math.round(cx + RING_RADIUS * Math.sin(angle)),
                y: Math.round(cy - RING_RADIUS * Math.cos(angle))
            })
        }
        return centers
    }

    function solarDotCenters(cx, cy) {
        return SOLAR_DOT_OFFSETS.map((o) => ({ x: cx + o.x, y: cy + o.y }))
    }

    function letterSlotCenters(screenWidth) {
        const left = Math.round((screenWidth / 2 - GLYPH_HALF_REACH) / 2)
        return [left, screenWidth - left]
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            SEQUENCE,
            ECLIPSES_TT,
            TT_MINUS_UTC_SECONDS,
            SOLAR_LEVEL,
            SOLAR_ANCHOR_ORDINAL,
            SOLAR_CYCLES_PER_SYNC,
            DEFAULT_TOP_DEPTH,
            MIN_TOP_DEPTH,
            MAX_TOP_DEPTH,
            prefix,
            siblingCount,
            ttFromUtcMilliseconds,
            positionAt,
            timestampAtRational,
            phaseAt,
            solarAt,
            GREEK,
            nextThreshold,
            periodName,
            utcOffsetSeconds,
            wallClock,
            syncClockText,
            thresholdText,
            clampTopDepth,
            tickMilliseconds,
            ringDotCenters,
            solarDotCenters,
            letterSlotCenters,
            layout: { GLYPH_STEM_X, GLYPH_CENTER_Y, DOT_SIZE, RING_RADIUS, RING_SPACING }
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
    let rings = []
    let solarRing = null
    let syncLabel = null
    let thresholdLabel = null
    let infoHideAt = 0
    let letterSlots = []
    let lettersPersistent = false
    let lettersHideAt = 0
    let lastMiddleTapAt = 0

    function asset(name) {
        return 'fx/' + name + '.png'
    }

    function createRing(cy, color, dotCount) {
        const cx = Math.floor(screenWidth / 2)
        const glyph = hmUI.createWidget(hmUI.widget.IMG, {
            x: cx - GLYPH_STEM_X,
            y: cy - GLYPH_CENTER_Y,
            w: GLYPH_W,
            h: GLYPH_H,
            src: asset(color + '_0')
        })
        const dots = []
        for (let k = 0; k < dotCount; k++) {
            dots.push(hmUI.createWidget(hmUI.widget.IMG, {
                x: cx,
                y: cy,
                w: DOT_SIZE,
                h: DOT_SIZE,
                src: asset(color + '_dot_off')
            }))
        }
        return {
            cx: cx,
            cy: cy,
            color: color,
            glyph: glyph,
            glyphSource: '',
            dots: dots,
            dotSources: dots.map(() => ''),
            siblings: 0
        }
    }

    function layoutRing(ring, siblings) {
        if (ring.siblings === siblings) {
            return
        }
        const centers = ring.color === 'yellow'
            ? solarDotCenters(ring.cx, ring.cy)
            : ringDotCenters(ring.cx, ring.cy, siblings)
        for (let k = 0; k < ring.dots.length; k++) {
            const visible = k < centers.length
            if (visible) {
                ring.dots[k].setProperty(hmUI.prop.MORE, {
                    x: centers[k].x - (DOT_SIZE >> 1),
                    y: centers[k].y - (DOT_SIZE >> 1),
                    w: DOT_SIZE,
                    h: DOT_SIZE
                })
            }
            ring.dots[k].setProperty(hmUI.prop.VISIBLE, visible)
        }
        ring.siblings = siblings
    }

    function drawRing(ring, index, local) {
        const glyphSource = asset(ring.color + '_' + index)
        if (glyphSource !== ring.glyphSource) {
            ring.glyph.setProperty(hmUI.prop.SRC, glyphSource)
            ring.glyphSource = glyphSource
        }
        for (let k = 0; k < ring.siblings - 1; k++) {
            const source = asset(ring.color + (k < local ? '_dot_on' : '_dot_off'))
            if (source !== ring.dotSources[k]) {
                ring.dots[k].setProperty(hmUI.prop.SRC, source)
                ring.dotSources[k] = source
            }
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
        for (let i = 0; i < rings.length; i++) {
            const phase = phaseAt(position, topDepth - 1 + i)
            layoutRing(rings[i], phase.siblings)
            drawRing(rings[i], phase.index, phase.local)
        }
        const solar = solarAt(tt)
        drawRing(solarRing, solar.index, solar.day)
        if (infoHideAt) {
            if (time.utc >= infoHideAt) {
                setInfoVisible(false)
                infoHideAt = 0
            } else {
                drawInfo(tt, position, solar)
            }
        }
        if (lettersHideAt && time.utc >= lettersHideAt) {
            lettersHideAt = 0
            setLettersVisible(lettersPersistent)
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

    function drawInfo(tt, position, solar) {
        const offset = localOffsetSeconds()
        syncLabel.setProperty(hmUI.prop.TEXT, syncClockText(solar.syncStart, offset))
        const threshold = nextThreshold(position, topDepth - 1)
        thresholdLabel.setProperty(hmUI.prop.TEXT, thresholdText(threshold, time.utc / 1000, offset))
    }

    function setInfoVisible(visible) {
        syncLabel.setProperty(hmUI.prop.VISIBLE, visible)
        thresholdLabel.setProperty(hmUI.prop.VISIBLE, visible)
    }

    function showInfo() {
        const tt = ttFromUtcMilliseconds(time.utc)
        const position = positionAt(tt)
        if (position === null) {
            return
        }
        drawInfo(tt, position, solarAt(tt))
        setInfoVisible(true)
        infoHideAt = time.utc + INFO_MILLISECONDS
    }

    // Single tap: sync time and next threshold for a few seconds.
    // Double tap: also toggles persistent period letters.
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
            setLettersVisible(lettersPersistent)
            return
        }
        lastMiddleTapAt = now
        showInfo()
    }

    function createLetterSlot(centerX, centerY) {
        const widget = (w, h, src) => hmUI.createWidget(hmUI.widget.IMG, { x: centerX, y: centerY, w: w, h: h, src: src })
        return {
            centerX: centerX,
            centerY: centerY,
            letter: widget(LETTER_W, LETTER_H, asset('greek_0')),
            subs: [widget(SUB_W, SUB_H, asset('sub_0')), widget(SUB_W, SUB_H, asset('sub_0'))],
            suffix: ''
        }
    }

    function layoutLetterSlot(slot, depth) {
        const name = periodName(depth)
        const width = LETTER_W + name.suffix.length * SUB_W
        const left = slot.centerX - Math.floor(width / 2)
        const top = slot.centerY - (LETTER_H >> 1)
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

    function setLettersVisible(visible) {
        for (let i = 0; i < letterSlots.length; i++) {
            const slot = letterSlots[i]
            slot.letter.setProperty(hmUI.prop.VISIBLE, visible)
            for (let k = 0; k < slot.subs.length; k++) {
                slot.subs[k].setProperty(hmUI.prop.VISIBLE, visible && k < slot.suffix.length)
            }
        }
    }

    // Left: the top (longer) period; right: the bottom (shorter) one.
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
        setLettersVisible(true)
        lettersHideAt = lettersPersistent ? 0 : time.utc + LETTER_MILLISECONDS
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
        time = hmSensor.createSensor(hmSensor.id.TIME)
        const storedDepth = hmFS.SysProGetInt(DEPTH_STORAGE_KEY)
        topDepth = storedDepth ? clampTopDepth(storedDepth) : DEFAULT_TOP_DEPTH
        lettersPersistent = hmFS.SysProGetInt(LETTERS_STORAGE_KEY) === LETTERS_STORED_ON

        const centerY = Math.floor(screenHeight / 2)
        rings = [
            createRing(centerY - RING_SPACING, 'teal', MAX_RING_DOTS),
            createRing(centerY + RING_SPACING, 'teal', MAX_RING_DOTS)
        ]
        solarRing = createRing(centerY, 'yellow', SOLAR_DAYS_PER_SYNC - 1)
        layoutRing(solarRing, SOLAR_DAYS_PER_SYNC)

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
        // On tap: the top glyph's next threshold above the solar glyph and
        // the local time of the current sync point below it.
        thresholdLabel = label(centerY - INFO_LABEL_OFFSET - LABEL_HEIGHT, THRESHOLD_COLOR)
        syncLabel = label(centerY + SYNC_LABEL_OFFSET, SYNC_COLOR)
        setInfoVisible(false)

        letterSlots = [
            // Same row as the solar side dots.
            createLetterSlot(letterSlotCenters(screenWidth)[0], centerY + SOLAR_DOT_OFFSETS[0].y),
            createLetterSlot(letterSlotCenters(screenWidth)[1], centerY + SOLAR_DOT_OFFSETS[0].y)
        ]
        updateLetters()
        setLettersVisible(lettersPersistent)

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
