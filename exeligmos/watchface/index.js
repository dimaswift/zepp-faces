(() => {
    'use strict'

    // Ten octal digits make a 2^30 carrier. Qualified Spikes have at least five
    // repeated trailing digits, so the free prefix is five digits wide.
    const BASE_DIGITS = 10
    const BASE_BIN_COUNT = Math.pow(8, BASE_DIGITS)
    const PHASE_UPPER_BOUND = 1 - 2.220446049250313e-16
    const MIN_SPIKE_REPEAT_LENGTH = 5
    const SPIKE_PREFIX_DEPTH = BASE_DIGITS - MIN_SPIKE_REPEAT_LENGTH
    // Suppression spans are powers of two in the raw qualified-Spike stream.
    // A span ends early when it reaches a Spike of equal or greater rarity.
    const MAX_SUPPRESSION_DISTANCE = 64
    const SPIKE_CONTEXT_COUNT = MAX_SUPPRESSION_DISTANCE + 1
    const FORECAST_DOT_COUNT = 4
    const EVENT_CURSOR_EPSILON_SECONDS = 0.001
    const FIRST_SAROS = 117
    const SERIES_COUNT = 40
    const FIXED_SAROS = 141
    const MODE_FIXED = 0
    const MODE_CLOSEST_SPIKE = 1
    const MODE_STORAGE_KEY = 'exeligmos_face_mode'
    const DOT_VISIBILITY_STORAGE_KEY = 'exeligmos_dot_visibility'
    const DOTS_STORED_VISIBLE = 1
    const DOTS_STORED_HIDDEN = 2

    const GLYPH_SIZE = 176
    const GLYPH_DIGITS = 5
    const LABEL_HEIGHT = 40
    const GLYPH_DIVIDER_HALF_GAP = 24
    const FORECAST_DOT_SIZE = 8
    const FORECAST_DOT_GAP = 8
    const FORECAST_DOT_Y = 28
    const TOUCH_ZONE_FRACTION = 0.2
    const ARROW_BLINK_MIN_MILLISECONDS = 66
    const ARROW_BLINK_MAX_MILLISECONDS = 4240
    const SAROS_LABEL_HALF_WIDTH = 28
    const ARROW_LABEL_WIDTH = 24
    const ARROW_LABEL_GAP = 4
    const TICK_MILLISECONDS = ARROW_BLINK_MIN_MILLISECONDS

    const RARITY_COLORS = {
        white: 0xFFFFFF,
        blue: 0x0A84FF,
        purple: 0xBF5AF2,
        yellow: 0xFFD60A,
        red: 0xFF453A,
        green: 0x30D158
    }

    // One past eclipse and two future eclipses for every active solar Saros
    // series on 2026-07-15. Values are Unix seconds. Row i is Saros 117 + i.
    const SAROS_ECLIPSE_SECONDS = [
        1531450936, 2100421926, 2669393042, // 117
        1306963038, 1875931573, 2444899951, // 118
        1651351356, 2220320582, 2789289565, // 119
        1426844807, 1995818556, 2564791839, // 120
        1771330386, 2340303879, 2909276776, // 121
        1546738958, 2115712135, 2684685245, // 122
        1322202084, 1891177438, 2460153012, // 123
        1666695680, 2235668942, 2804642587, // 124
        1442127319, 2011096471, 2580066134, // 125
        1217586132, 1786556826, 2355527822, // 126
        1562095447, 2131065636, 2700035870, // 127
        1337558034, 1906525753, 2475493133, // 128
        1681964276, 2250935541, 2819906536, // 129
        1457488699, 2026462725, 2595436313, // 130
        1232956785, 1801929648, 2370902167, // 131
        1577337533, 2146312031, 2715286605, // 132
        1352844775, 1921819897, 2490795327, // 133
        1697306441, 2266277782, 2835249495, // 134
        1472720882, 2041690768, 2610661150, // 135
        1248230185, 1817201270, 2386172559, // 136
        1592721675, 2161690375, 2730658919, // 137
        1368145580, 1937114164, 2506082399, // 138
        1712600309, 2281573050, 2850545400, // 139
        1488120873, 2057094354, 2626067299, // 140
        1263539259, 1832512139, 2401484786, // 141
        1607962479, 2176938010, 2745913672, // 142
        1383482856, 1952456851, 2521431228, // 143
        1727894773, 2296864842, 2865835450, // 144
        1503340000, 2072311006, 2641282449, // 145
        1278876878, 1847847400, 2416818073, // 146
        1623321787, 2192289174, 2761256415, // 147
        1398751473, 1967722002, 2536692170, // 148
        1743245316, 2312218669, 2881191409, // 149
        1518727953, 2087700409, 2656672420, // 150
        1294131102, 1863105228, 2432079198, // 151
        1638603278, 2207579026, 2776554875, // 152
        1414100739, 1983072853, 2552045453, // 153
        1758483784, 2327454109, 2896425130, // 154
        1533980848, 2102952345, 2671924174, // 155
        1309509570, 1878478639, 2447447777  // 156
    ]

    function clamp(value, lower, upper) {
        return Math.min(Math.max(value, lower), upper)
    }

    function touchZoneLayout(height) {
        const zoneHeight = Math.floor(height * TOUCH_ZONE_FRACTION)
        return {
            topY: 0,
            topHeight: zoneHeight,
            bottomY: height - zoneHeight,
            bottomHeight: zoneHeight
        }
    }

    function positiveModulo(value, modulus) {
        const remainder = value % modulus
        return remainder >= 0 ? remainder : remainder + modulus
    }

    function octalAddress(value, digits) {
        let result = Math.max(Math.floor(value), 0).toString(8)
        if (result.length > digits) {
            result = result.slice(result.length - digits)
        }
        while (result.length < digits) {
            result = '0' + result
        }
        return result
    }

    function seriesIndexForSaros(saros) {
        return clamp(saros - FIRST_SAROS, 0, SERIES_COUNT - 1)
    }

    function eclipseTriplet(seriesIndex) {
        const offset = clamp(seriesIndex, 0, SERIES_COUNT - 1) * 3
        return [
            SAROS_ECLIPSE_SECONDS[offset],
            SAROS_ECLIPSE_SECONDS[offset + 1],
            SAROS_ECLIPSE_SECONDS[offset + 2]
        ]
    }

    function intervalForSeries(seriesIndex, nowSeconds) {
        const triplet = eclipseTriplet(seriesIndex)
        const first = triplet[0]
        const second = triplet[1]
        const third = triplet[2]

        if (nowSeconds < first || nowSeconds >= third) {
            return null
        }

        if (nowSeconds < second) {
            return { start: first, end: second }
        }

        return { start: second, end: third }
    }

    function readingForSeries(seriesIndex, nowSeconds) {
        const interval = intervalForSeries(seriesIndex, nowSeconds)
        if (interval === null) {
            return null
        }
        const duration = Math.max(interval.end - interval.start, 1)
        const phase = clamp((nowSeconds - interval.start) / duration, 0, PHASE_UPPER_BOUND)
        const binIndex = Math.min(Math.floor(phase * BASE_BIN_COUNT), BASE_BIN_COUNT - 1)

        return {
            seriesIndex: seriesIndex,
            saros: FIRST_SAROS + seriesIndex,
            intervalStart: interval.start,
            intervalEnd: interval.end,
            phase: phase,
            binIndex: binIndex,
            address: octalAddress(binIndex, BASE_DIGITS)
        }
    }

    function nextRepdigitBin(afterBinIndex, prefixDepth) {
        const depth = clamp(prefixDepth, 1, BASE_DIGITS - 1)
        const suffixLength = Math.max(BASE_DIGITS - depth, 1)
        const stride = Math.pow(8, suffixLength)
        const repunit = (stride - 1) / 7
        const firstFutureBin = afterBinIndex + 1
        let bestBin = null

        for (let repeatedDigit = 1; repeatedDigit <= 7; repeatedDigit++) {
            const offset = repeatedDigit * repunit
            const remainder = positiveModulo(firstFutureBin - offset, stride)
            const candidate = remainder === 0
                ? firstFutureBin
                : firstFutureBin + stride - remainder

            if (candidate > 0 && candidate < BASE_BIN_COUNT && (bestBin === null || candidate < bestBin)) {
                bestBin = candidate
            }
        }

        return bestBin
    }

    function previousRepdigitBin(atOrBeforeBinIndex, prefixDepth) {
        const depth = clamp(prefixDepth, 1, BASE_DIGITS - 1)
        const suffixLength = Math.max(BASE_DIGITS - depth, 1)
        const stride = Math.pow(8, suffixLength)
        const repunit = (stride - 1) / 7
        let bestBin = null

        for (let repeatedDigit = 1; repeatedDigit <= 7; repeatedDigit++) {
            const offset = repeatedDigit * repunit
            const candidate = atOrBeforeBinIndex
                - positiveModulo(atOrBeforeBinIndex - offset, stride)

            if (candidate > 0 && candidate < BASE_BIN_COUNT && (bestBin === null || candidate > bestBin)) {
                bestBin = candidate
            }
        }

        return bestBin
    }

    function trailingNonzeroRepeatLength(address) {
        const last = address.charAt(address.length - 1)
        if (last === '0' || last === '') {
            return 0
        }

        let length = 0
        for (let index = address.length - 1; index >= 0; index--) {
            if (address.charAt(index) !== last) {
                break
            }
            length++
        }
        return length
    }

    function rarityForRepeatLength(length) {
        if (length >= 9) {
            return { name: 'red', rank: 4, suppressionDistance: 64 }
        }
        if (length === 8) {
            return { name: 'yellow', rank: 3, suppressionDistance: 32 }
        }
        if (length === 7) {
            return { name: 'purple', rank: 2, suppressionDistance: 16 }
        }
        if (length === 6) {
            return { name: 'blue', rank: 1, suppressionDistance: 8 }
        }
        return { name: 'white', rank: 0, suppressionDistance: 0 }
    }

    function spikeAtBin(seriesIndex, interval, binIndex) {
        const address = octalAddress(binIndex, BASE_DIGITS)
        const repeatLength = trailingNonzeroRepeatLength(address)
        const repeatedDigit = parseInt(address.charAt(address.length - 1), 10)
        const rarity = rarityForRepeatLength(repeatLength)
        const eventSeconds = interval.start
            + (binIndex / BASE_BIN_COUNT) * (interval.end - interval.start)

        return {
            seriesIndex: seriesIndex,
            saros: FIRST_SAROS + seriesIndex,
            binIndex: binIndex,
            address: address,
            repeatLength: repeatLength,
            repeatedDigit: repeatedDigit,
            rarity: rarity.name,
            rarityRank: rarity.rank,
            suppressionDistance: rarity.suppressionDistance,
            eventSeconds: eventSeconds
        }
    }

    function eclipseSpike(seriesIndex, interval) {
        const rarity = rarityForRepeatLength(BASE_DIGITS)
        return {
            seriesIndex: seriesIndex,
            saros: FIRST_SAROS + seriesIndex,
            binIndex: BASE_BIN_COUNT,
            address: '7777777777',
            repeatLength: BASE_DIGITS,
            repeatedDigit: 7,
            rarity: 'red',
            rarityRank: 4,
            suppressionDistance: rarity.suppressionDistance,
            eventSeconds: interval.end
        }
    }

    function previousEclipseSpike(seriesIndex, interval) {
        const rarity = rarityForRepeatLength(BASE_DIGITS)
        return {
            seriesIndex: seriesIndex,
            saros: FIRST_SAROS + seriesIndex,
            binIndex: BASE_BIN_COUNT,
            address: '7777777777',
            repeatLength: BASE_DIGITS,
            repeatedDigit: 7,
            rarity: 'red',
            rarityRank: 4,
            suppressionDistance: rarity.suppressionDistance,
            eventSeconds: interval.start
        }
    }

    function earlierSpike(first, second) {
        if (first === null) {
            return second
        }
        if (second === null) {
            return first
        }
        if (first.eventSeconds !== second.eventSeconds) {
            return first.eventSeconds < second.eventSeconds ? first : second
        }
        if (first.rarityRank !== second.rarityRank) {
            return first.rarityRank > second.rarityRank ? first : second
        }
        return first.saros <= second.saros ? first : second
    }

    function laterSpike(first, second) {
        if (first === null) {
            return second
        }
        if (second === null) {
            return first
        }
        if (first.eventSeconds !== second.eventSeconds) {
            return first.eventSeconds > second.eventSeconds ? first : second
        }
        if (first.rarityRank !== second.rarityRank) {
            return first.rarityRank > second.rarityRank ? first : second
        }
        return first.saros <= second.saros ? first : second
    }

    function closerSpike(first, second, nowSeconds) {
        if (first === null) {
            return second
        }
        if (second === null) {
            return first
        }

        const firstDistance = Math.abs(first.eventSeconds - nowSeconds)
        const secondDistance = Math.abs(second.eventSeconds - nowSeconds)
        if (firstDistance !== secondDistance) {
            return firstDistance < secondDistance ? first : second
        }

        const firstIsIncoming = first.eventSeconds >= nowSeconds
        const secondIsIncoming = second.eventSeconds >= nowSeconds
        if (firstIsIncoming !== secondIsIncoming) {
            return firstIsIncoming ? first : second
        }
        if (first.rarityRank !== second.rarityRank) {
            return first.rarityRank > second.rarityRank ? first : second
        }
        return first.saros <= second.saros ? first : second
    }

    function previousSpikeForSeries(seriesIndex, nowSeconds, prefixDepth) {
        const reading = readingForSeries(seriesIndex, nowSeconds)
        if (reading === null) {
            return null
        }
        const interval = { start: reading.intervalStart, end: reading.intervalEnd }
        let candidateBin = previousRepdigitBin(reading.binIndex + 1, prefixDepth)
        let candidate = null

        // The +1 catches an exact bin boundary reconstructed one ulp low. If it
        // points ahead of the clock, walk back to the actual previous event.
        while (candidateBin !== null) {
            candidate = spikeAtBin(seriesIndex, interval, candidateBin)
            if (candidate.eventSeconds <= nowSeconds) {
                break
            }
            candidateBin = previousRepdigitBin(candidateBin - 1, prefixDepth)
            candidate = null
        }

        return laterSpike(candidate, previousEclipseSpike(seriesIndex, interval))
    }

    function nextSpikeForSeries(seriesIndex, nowSeconds, prefixDepth) {
        const reading = readingForSeries(seriesIndex, nowSeconds)
        if (reading === null) {
            return null
        }
        const interval = { start: reading.intervalStart, end: reading.intervalEnd }
        let candidateBin = nextRepdigitBin(reading.binIndex, prefixDepth)
        let candidate = null

        // Reconstructing an event time can put the scaled phase one ulp below
        // its integer bin. Advance past any equal/past candidate without
        // discarding the rest of the current eclipse interval.
        while (candidateBin !== null) {
            candidate = spikeAtBin(seriesIndex, interval, candidateBin)
            if (candidate.eventSeconds > nowSeconds) {
                break
            }
            candidateBin = nextRepdigitBin(candidateBin, prefixDepth)
            candidate = null
        }

        // Eclipses are the red all-seven boundary of a Saros period.
        candidate = earlierSpike(candidate, eclipseSpike(seriesIndex, interval))
        if (candidate !== null && candidate.eventSeconds > nowSeconds) {
            return candidate
        }

        const nextInterval = intervalForSeries(seriesIndex, interval.end + 0.001)
        if (nextInterval === null) {
            return null
        }
        const nextBin = nextRepdigitBin(-1, prefixDepth)
        const nextCandidate = nextBin === null
            ? null
            : spikeAtBin(seriesIndex, nextInterval, nextBin)
        return earlierSpike(nextCandidate, eclipseSpike(seriesIndex, nextInterval))
    }

    function closestUpcomingSpike(nowSeconds, prefixDepth) {
        let best = null
        for (let seriesIndex = 0; seriesIndex < SERIES_COUNT; seriesIndex++) {
            best = earlierSpike(best, nextSpikeForSeries(seriesIndex, nowSeconds, prefixDepth))
        }
        return best
    }

    function closestSpikeAround(nowSeconds, prefixDepth) {
        let best = null
        for (let seriesIndex = 0; seriesIndex < SERIES_COUNT; seriesIndex++) {
            const previous = previousSpikeForSeries(seriesIndex, nowSeconds, prefixDepth)
            const next = nextSpikeForSeries(seriesIndex, nowSeconds, prefixDepth)
            best = closerSpike(best, previous, nowSeconds)
            best = closerSpike(best, next, nowSeconds)
        }
        return best
    }

    function collectUpcomingSpikesForSeries(seriesIndex, nowSeconds, count, prefixDepth) {
        const spikes = []
        let cursorSeconds = nowSeconds

        while (spikes.length < count) {
            const spike = nextSpikeForSeries(seriesIndex, cursorSeconds, prefixDepth)
            if (spike === null) {
                break
            }
            spikes.push(spike)
            cursorSeconds = spike.eventSeconds
        }

        return spikes
    }

    function collectPreviousSpikesForSeries(seriesIndex, nowSeconds, count, prefixDepth) {
        const spikes = []
        let cursorSeconds = nowSeconds

        while (spikes.length < count) {
            const spike = previousSpikeForSeries(seriesIndex, cursorSeconds, prefixDepth)
            if (spike === null) {
                break
            }
            spikes.push(spike)
            cursorSeconds = spike.eventSeconds - EVENT_CURSOR_EPSILON_SECONDS
        }

        return spikes
    }

    function collectUpcomingGlobalSpikes(nowSeconds, count, prefixDepth) {
        const cursors = []
        const spikes = []
        for (let seriesIndex = 0; seriesIndex < SERIES_COUNT; seriesIndex++) {
            cursors.push(nextSpikeForSeries(seriesIndex, nowSeconds, prefixDepth))
        }

        while (spikes.length < count) {
            let bestIndex = -1
            for (let seriesIndex = 0; seriesIndex < SERIES_COUNT; seriesIndex++) {
                if (cursors[seriesIndex] === null) {
                    continue
                }
                if (bestIndex === -1 || earlierSpike(cursors[seriesIndex], cursors[bestIndex]) === cursors[seriesIndex]) {
                    bestIndex = seriesIndex
                }
            }
            if (bestIndex === -1) {
                break
            }

            const spike = cursors[bestIndex]
            spikes.push(spike)
            cursors[bestIndex] = nextSpikeForSeries(bestIndex, spike.eventSeconds, prefixDepth)
        }

        return spikes
    }

    function collectPreviousGlobalSpikes(nowSeconds, count, prefixDepth) {
        const cursors = []
        const spikes = []
        for (let seriesIndex = 0; seriesIndex < SERIES_COUNT; seriesIndex++) {
            cursors.push(previousSpikeForSeries(seriesIndex, nowSeconds, prefixDepth))
        }

        while (spikes.length < count) {
            let bestIndex = -1
            for (let seriesIndex = 0; seriesIndex < SERIES_COUNT; seriesIndex++) {
                if (cursors[seriesIndex] === null) {
                    continue
                }
                if (bestIndex === -1 || laterSpike(cursors[seriesIndex], cursors[bestIndex]) === cursors[seriesIndex]) {
                    bestIndex = seriesIndex
                }
            }
            if (bestIndex === -1) {
                break
            }

            const spike = cursors[bestIndex]
            spikes.push(spike)
            cursors[bestIndex] = previousSpikeForSeries(
                bestIndex,
                spike.eventSeconds - EVENT_CURSOR_EPSILON_SECONDS,
                prefixDepth
            )
        }

        return spikes
    }

    function canSuppressTimelineIndex(timeline, candidateIndex, rawIndex) {
        if (candidateIndex === rawIndex) {
            return true
        }

        const candidate = timeline[candidateIndex]
        const rarity = rarityForRepeatLength(candidate.repeatLength)
        if (Math.abs(candidateIndex - rawIndex) > rarity.suppressionDistance) {
            return false
        }

        const step = candidateIndex < rawIndex ? 1 : -1
        for (let index = candidateIndex + step; ; index += step) {
            // Equal and higher rarities are hard boundaries. The candidate
            // does not suppress the boundary Spike or anything beyond it.
            if (timeline[index].rarityRank >= rarity.rank) {
                return false
            }
            if (index === rawIndex) {
                return true
            }
        }
    }

    function dominantSpikeForTimeline(timeline, rawIndex, nowSeconds) {
        if (rawIndex < 0 || rawIndex >= timeline.length) {
            return null
        }

        let best = timeline[rawIndex]
        let bestIndex = rawIndex

        for (let index = 0; index < timeline.length; index++) {
            const candidate = timeline[index]
            const sequenceDistance = Math.abs(index - rawIndex)
            if (!canSuppressTimelineIndex(timeline, index, rawIndex)) {
                continue
            }
            const rarity = rarityForRepeatLength(candidate.repeatLength)

            if (rarity.rank > best.rarityRank) {
                best = candidate
                bestIndex = index
                continue
            }
            if (rarity.rank < best.rarityRank || bestIndex === rawIndex) {
                continue
            }

            const bestSequenceDistance = Math.abs(bestIndex - rawIndex)
            if (sequenceDistance < bestSequenceDistance) {
                best = candidate
                bestIndex = index
                continue
            }
            if (sequenceDistance > bestSequenceDistance) {
                continue
            }

            const candidateTimeDistance = Math.abs(candidate.eventSeconds - nowSeconds)
            const bestTimeDistance = Math.abs(best.eventSeconds - nowSeconds)
            if (candidateTimeDistance < bestTimeDistance) {
                best = candidate
                bestIndex = index
            }
        }

        return best
    }

    function suppressionBoundarySeconds(timeline, spike, nowSeconds) {
        const spikeIndex = timeline.indexOf(spike)
        if (spikeIndex < 0) {
            return spike.eventSeconds
        }

        const rarity = rarityForRepeatLength(spike.repeatLength)
        const direction = nowSeconds < spike.eventSeconds ? -1 : 1
        let edgeIndex = spikeIndex

        for (let distance = 1; distance <= rarity.suppressionDistance; distance++) {
            const nextIndex = spikeIndex + direction * distance
            if (nextIndex < 0 || nextIndex >= timeline.length) {
                break
            }
            if (timeline[nextIndex].rarityRank >= rarity.rank) {
                break
            }
            edgeIndex = nextIndex
        }

        const outsideIndex = edgeIndex + direction
        if (outsideIndex >= 0 && outsideIndex < timeline.length) {
            return (timeline[edgeIndex].eventSeconds + timeline[outsideIndex].eventSeconds) / 2
        }
        return timeline[edgeIndex].eventSeconds
    }

    function arrowBlinkIntervalMilliseconds(state, nowSeconds) {
        const spikeSeconds = state.spike.eventSeconds
        const farDistanceSeconds = Math.abs(state.proximityBoundarySeconds - spikeSeconds)
        if (farDistanceSeconds <= 0) {
            return ARROW_BLINK_MIN_MILLISECONDS
        }

        const distanceRatio = clamp(
            Math.abs(nowSeconds - spikeSeconds) / farDistanceSeconds,
            0,
            1
        )
        return Math.round(
            ARROW_BLINK_MIN_MILLISECONDS
            + distanceRatio * (ARROW_BLINK_MAX_MILLISECONDS - ARROW_BLINK_MIN_MILLISECONDS)
        )
    }

    function spikeStateFromNeighbors(previous, upcoming, nowSeconds) {
        const previousSpike = previous.length > 0 ? previous[0] : null
        const upcomingSpike = upcoming.length > 0 ? upcoming[0] : null
        const rawSpike = closerSpike(previousSpike, upcomingSpike, nowSeconds)
        if (rawSpike === null) {
            return null
        }

        const timeline = previous.slice().reverse().concat(upcoming)
        const rawIndex = timeline.indexOf(rawSpike)
        const spike = dominantSpikeForTimeline(timeline, rawIndex, nowSeconds)
        if (spike === null) {
            return null
        }

        return {
            rawSpike: rawSpike,
            spike: spike,
            direction: spike.eventSeconds > nowSeconds ? 'future' : 'past',
            forecast: upcoming.slice(0, FORECAST_DOT_COUNT),
            proximityBoundarySeconds: suppressionBoundarySeconds(timeline, spike, nowSeconds),
            validUntilSeconds: stateValidUntil(previousSpike, upcomingSpike, nowSeconds)
        }
    }

    function stateValidUntil(previousSpike, upcomingSpike, nowSeconds) {
        if (upcomingSpike === null) {
            return nowSeconds + 60
        }

        let validUntilSeconds = upcomingSpike.eventSeconds
        if (previousSpike !== null) {
            const midpointSeconds = (previousSpike.eventSeconds + upcomingSpike.eventSeconds) / 2
            if (midpointSeconds > nowSeconds) {
                validUntilSeconds = Math.min(validUntilSeconds, midpointSeconds)
            }
        }
        return validUntilSeconds
    }

    function spikeStateForSeries(seriesIndex, nowSeconds, prefixDepth) {
        const previous = collectPreviousSpikesForSeries(
            seriesIndex,
            nowSeconds,
            SPIKE_CONTEXT_COUNT,
            prefixDepth
        )
        const upcoming = collectUpcomingSpikesForSeries(
            seriesIndex,
            nowSeconds,
            SPIKE_CONTEXT_COUNT,
            prefixDepth
        )
        return spikeStateFromNeighbors(previous, upcoming, nowSeconds)
    }

    function globalSpikeState(nowSeconds, prefixDepth) {
        const previous = collectPreviousGlobalSpikes(nowSeconds, SPIKE_CONTEXT_COUNT, prefixDepth)
        const upcoming = collectUpcomingGlobalSpikes(nowSeconds, SPIKE_CONTEXT_COUNT, prefixDepth)
        return spikeStateFromNeighbors(previous, upcoming, nowSeconds)
    }

    // Make the pure model testable without starting the Zepp runtime.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            BASE_DIGITS: BASE_DIGITS,
            BASE_BIN_COUNT: BASE_BIN_COUNT,
            MIN_SPIKE_REPEAT_LENGTH: MIN_SPIKE_REPEAT_LENGTH,
            SPIKE_PREFIX_DEPTH: SPIKE_PREFIX_DEPTH,
            MAX_SUPPRESSION_DISTANCE: MAX_SUPPRESSION_DISTANCE,
            FORECAST_DOT_COUNT: FORECAST_DOT_COUNT,
            TOUCH_ZONE_FRACTION: TOUCH_ZONE_FRACTION,
            ARROW_BLINK_MIN_MILLISECONDS: ARROW_BLINK_MIN_MILLISECONDS,
            ARROW_BLINK_MAX_MILLISECONDS: ARROW_BLINK_MAX_MILLISECONDS,
            FIRST_SAROS: FIRST_SAROS,
            SERIES_COUNT: SERIES_COUNT,
            SAROS_ECLIPSE_SECONDS: SAROS_ECLIPSE_SECONDS,
            octalAddress: octalAddress,
            touchZoneLayout: touchZoneLayout,
            seriesIndexForSaros: seriesIndexForSaros,
            eclipseTriplet: eclipseTriplet,
            intervalForSeries: intervalForSeries,
            readingForSeries: readingForSeries,
            nextRepdigitBin: nextRepdigitBin,
            previousRepdigitBin: previousRepdigitBin,
            trailingNonzeroRepeatLength: trailingNonzeroRepeatLength,
            rarityForRepeatLength: rarityForRepeatLength,
            previousSpikeForSeries: previousSpikeForSeries,
            nextSpikeForSeries: nextSpikeForSeries,
            closestUpcomingSpike: closestUpcomingSpike,
            closestSpikeAround: closestSpikeAround,
            collectUpcomingSpikesForSeries: collectUpcomingSpikesForSeries,
            collectPreviousSpikesForSeries: collectPreviousSpikesForSeries,
            collectUpcomingGlobalSpikes: collectUpcomingGlobalSpikes,
            collectPreviousGlobalSpikes: collectPreviousGlobalSpikes,
            canSuppressTimelineIndex: canSuppressTimelineIndex,
            dominantSpikeForTimeline: dominantSpikeForTimeline,
            suppressionBoundarySeconds: suppressionBoundarySeconds,
            arrowBlinkIntervalMilliseconds: arrowBlinkIntervalMilliseconds,
            spikeStateFromNeighbors: spikeStateFromNeighbors,
            spikeStateForSeries: spikeStateForSeries,
            globalSpikeState: globalSpikeState
        }
    }

    if (typeof DeviceRuntimeCore === 'undefined') {
        return
    }

    let time = null
    let timerId = null
    let displayMode = MODE_FIXED
    let screenWidth = 0
    let screenHeight = 0
    let sarosLabel = null
    let arrowImage = null
    let topTapTarget = null
    let bottomTapTarget = null
    let glyphs = []
    let forecastDots = []
    let drawnKey = ''
    let cachedSpikeState = null
    let cachedStateMode = -1
    let cachedStateComputedAtSeconds = 0
    let forecastDotsVisible = true
    let arrowBright = true
    let arrowStateKey = ''
    let arrowLastToggleMilliseconds = 0

    function glyphAsset(colorName, filename, rotated) {
        return 'glyphs/' + colorName + (rotated ? '/rot180/' : '/') + filename
    }

    function blankGlyphAsset() {
        return 'glyphs/blank.png'
    }

    function arrowAsset(colorName, direction, bright) {
        return 'glyphs/arrows/' + colorName + '_' + (bright ? 'bright_' : 'dim_')
            + direction + '.png'
    }

    function createGlyph(y, rotated) {
        const x = Math.floor((screenWidth - GLYPH_SIZE) / 2)
        const core = hmUI.createWidget(hmUI.widget.IMG, {
            x: x,
            y: y,
            w: GLYPH_SIZE,
            h: GLYPH_SIZE,
            src: glyphAsset('blue', 'core.png', rotated)
        })
        const arms = []

        for (let socketIndex = 0; socketIndex < GLYPH_DIGITS; socketIndex++) {
            arms.push(hmUI.createWidget(hmUI.widget.IMG, {
                x: x,
                y: y,
                w: GLYPH_SIZE,
                h: GLYPH_SIZE,
                src: blankGlyphAsset()
            }))
        }

        return { core: core, arms: arms, rotated: rotated }
    }

    function digitIndexForSocket(socketIndex) {
        return socketIndex === 0 ? 0 : GLYPH_DIGITS - socketIndex
    }

    function updateGlyph(glyph, address, colorName) {
        glyph.core.setProperty(hmUI.prop.MORE, {
            src: glyphAsset(colorName, 'core.png', glyph.rotated)
        })

        for (let socketIndex = 0; socketIndex < GLYPH_DIGITS; socketIndex++) {
            const digitIndex = digitIndexForSocket(socketIndex)
            const digit = parseInt(address.charAt(digitIndex), 10)
            const source = digit === 0
                ? blankGlyphAsset()
                : glyphAsset(colorName, 's' + socketIndex + '_' + digit + '.png', glyph.rotated)
            glyph.arms[socketIndex].setProperty(hmUI.prop.MORE, { src: source })
        }
    }

    function updateForecastDots(forecast) {
        for (let index = 0; index < FORECAST_DOT_COUNT; index++) {
            const colorName = forecast[index] ? forecast[index].rarity : null
            forecastDots[index].setProperty(
                hmUI.prop.COLOR,
                colorName ? RARITY_COLORS[colorName] : 0x000000
            )
        }
    }

    function activeSpikeState(nowSeconds) {
        const cacheExpired = cachedSpikeState === null
            || cachedStateMode !== displayMode
            || nowSeconds < cachedStateComputedAtSeconds
            || nowSeconds >= cachedSpikeState.validUntilSeconds

        if (cacheExpired) {
            cachedSpikeState = displayMode === MODE_FIXED
                ? spikeStateForSeries(seriesIndexForSaros(FIXED_SAROS), nowSeconds, SPIKE_PREFIX_DEPTH)
                : globalSpikeState(nowSeconds, SPIKE_PREFIX_DEPTH)
            cachedStateMode = displayMode
            cachedStateComputedAtSeconds = nowSeconds
        }

        return cachedSpikeState
    }

    function selectDisplay(nowSeconds) {
        const state = activeSpikeState(nowSeconds)
        if (state === null) {
            return null
        }

        if (displayMode === MODE_FIXED) {
            const seriesIndex = seriesIndexForSaros(FIXED_SAROS)
            const reading = readingForSeries(seriesIndex, nowSeconds)
            if (reading === null || state === null) {
                return null
            }
            return {
                reading: reading,
                spike: state.spike,
                direction: state.direction,
                forecast: state.forecast,
                colorName: 'green',
                blinkIntervalMilliseconds: arrowBlinkIntervalMilliseconds(state, nowSeconds)
            }
        }

        const reading = readingForSeries(state.spike.seriesIndex, nowSeconds)
        if (reading === null) {
            return null
        }
        return {
            reading: reading,
            spike: state.spike,
            direction: state.direction,
            forecast: state.forecast,
            colorName: state.spike.rarity,
            blinkIntervalMilliseconds: arrowBlinkIntervalMilliseconds(state, nowSeconds)
        }
    }

    function updateArrow(display, nowMilliseconds, force) {
        const symbol = display.direction === 'future' ? '↑' : '↓'
        const stateKey = symbol + ':' + display.spike.saros + ':' + display.spike.eventSeconds
            + ':' + display.colorName
        const stateChanged = force || stateKey !== arrowStateKey
        let colorChanged = false
        if (stateChanged) {
            arrowStateKey = stateKey
            arrowBright = true
            arrowLastToggleMilliseconds = nowMilliseconds
        } else if (nowMilliseconds - arrowLastToggleMilliseconds >= display.blinkIntervalMilliseconds) {
            arrowBright = !arrowBright
            arrowLastToggleMilliseconds = nowMilliseconds
            colorChanged = true
        }

        if (stateChanged || colorChanged) {
            // A fixed-size image has no text geometry to invalidate or drift.
            arrowImage.setProperty(hmUI.prop.SRC, arrowAsset(
                display.colorName,
                display.direction,
                arrowBright
            ))
        }
    }

    function tick(force) {
        if (!time || !time.utc) {
            return
        }

        const nowSeconds = time.utc / 1000
        const display = selectDisplay(nowSeconds)
        if (display === null) {
            return
        }
        const address = display.reading.address
        const colorName = display.colorName
        const forecastKey = display.forecast.map(spike => spike.eventSeconds + ':' + spike.rarity).join(',')
        const key = display.reading.saros + '-' + address + '-' + colorName + '-'
            + display.direction + '-' + forecastKey + '-' + displayMode

        // Use the runtime clock for sub-second animation; the TIME sensor is
        // still the source of truth for Saros phase/event calculations.
        updateArrow(display, Date.now(), force)
        if (!force && key === drawnKey) {
            return
        }

        updateGlyph(glyphs[0], address.slice(0, 5), colorName)
        updateGlyph(glyphs[1], address.slice(5, 10), colorName)
        updateForecastDots(display.forecast)
        if (displayMode === MODE_CLOSEST_SPIKE) {
            sarosLabel.setProperty(hmUI.prop.TEXT, String(display.reading.saros))
            sarosLabel.setProperty(hmUI.prop.COLOR, RARITY_COLORS[colorName])
        }
        drawnKey = key
    }

    function toggleMode() {
        displayMode = displayMode === MODE_FIXED ? MODE_CLOSEST_SPIKE : MODE_FIXED
        hmFS.SysProSetInt(MODE_STORAGE_KEY, displayMode)
        cachedSpikeState = null
        drawnKey = ''
        applyModeVisibility()
        tick(true)
    }

    function applyModeVisibility() {
        const showGlobalOverlay = displayMode === MODE_CLOSEST_SPIKE
        sarosLabel.setProperty(hmUI.prop.VISIBLE, showGlobalOverlay)
        arrowImage.setProperty(hmUI.prop.VISIBLE, showGlobalOverlay)
        const showDots = showGlobalOverlay && forecastDotsVisible
        for (let index = 0; index < forecastDots.length; index++) {
            forecastDots[index].setProperty(hmUI.prop.VISIBLE, showDots)
        }
    }

    function toggleForecastDots() {
        forecastDotsVisible = !forecastDotsVisible
        hmFS.SysProSetInt(
            DOT_VISIBILITY_STORAGE_KEY,
            forecastDotsVisible ? DOTS_STORED_VISIBLE : DOTS_STORED_HIDDEN
        )
        applyModeVisibility()
    }

    function build() {
        const deviceInfo = hmSetting.getDeviceInfo()
        screenWidth = deviceInfo.width
        screenHeight = deviceInfo.height
        time = hmSensor.createSensor(hmSensor.id.TIME)

        const storedMode = hmFS.SysProGetInt(MODE_STORAGE_KEY)
        displayMode = storedMode === MODE_CLOSEST_SPIKE ? MODE_CLOSEST_SPIKE : MODE_FIXED
        const storedDotVisibility = hmFS.SysProGetInt(DOT_VISIBILITY_STORAGE_KEY)
        forecastDotsVisible = storedDotVisibility !== DOTS_STORED_HIDDEN

        const centerY = Math.floor(screenHeight / 2)
        sarosLabel = hmUI.createWidget(hmUI.widget.TEXT, {
            x: 0,
            y: centerY - Math.floor(LABEL_HEIGHT / 2),
            w: screenWidth,
            h: LABEL_HEIGHT,
            color: RARITY_COLORS.blue,
            text_size: 28,
            align_h: hmUI.align.CENTER_H,
            align_v: hmUI.align.CENTER_V,
            text_style: hmUI.text_style.NONE,
            text: '141'
        })
        arrowImage = hmUI.createWidget(hmUI.widget.IMG, {
            x: Math.floor(screenWidth / 2) - SAROS_LABEL_HALF_WIDTH
                - ARROW_LABEL_GAP - ARROW_LABEL_WIDTH,
            y: centerY - Math.floor(LABEL_HEIGHT / 2),
            w: ARROW_LABEL_WIDTH,
            h: LABEL_HEIGHT,
            src: arrowAsset('blue', 'future', true)
        })

        const dotRowWidth = FORECAST_DOT_COUNT * FORECAST_DOT_SIZE
            + (FORECAST_DOT_COUNT - 1) * FORECAST_DOT_GAP
        const firstDotX = Math.floor((screenWidth - dotRowWidth) / 2)
        forecastDots = []
        for (let index = 0; index < FORECAST_DOT_COUNT; index++) {
            forecastDots.push(hmUI.createWidget(hmUI.widget.FILL_RECT, {
                x: firstDotX + index * (FORECAST_DOT_SIZE + FORECAST_DOT_GAP),
                y: FORECAST_DOT_Y,
                w: FORECAST_DOT_SIZE,
                h: FORECAST_DOT_SIZE,
                radius: Math.floor(FORECAST_DOT_SIZE / 2),
                color: RARITY_COLORS.white
            }))
        }

        const firstGlyphY = centerY - GLYPH_SIZE - GLYPH_DIVIDER_HALF_GAP
        const secondGlyphY = centerY + GLYPH_DIVIDER_HALF_GAP
        glyphs = [createGlyph(firstGlyphY, false), createGlyph(secondGlyphY, true)]

        const touchZones = touchZoneLayout(screenHeight)
        topTapTarget = hmUI.createWidget(hmUI.widget.STROKE_RECT, {
            x: 0,
            y: touchZones.topY,
            w: screenWidth,
            h: touchZones.topHeight,
            radius: 0,
            color: 0x000000
        })
        topTapTarget.addEventListener(hmUI.event.CLICK_DOWN, toggleForecastDots)
        bottomTapTarget = hmUI.createWidget(hmUI.widget.STROKE_RECT, {
            x: 0,
            y: touchZones.bottomY,
            w: screenWidth,
            h: touchZones.bottomHeight,
            radius: 0,
            color: 0x000000
        })
        bottomTapTarget.addEventListener(hmUI.event.CLICK_DOWN, toggleMode)

        applyModeVisibility()
        tick(true)
        timerId = timer.createTimer(0, TICK_MILLISECONDS, () => tick(false), {})
    }

    var __$$app$$__ = __$$hmAppManager$$__.currentApp
    var __$$module$$__ = __$$app$$__.current
    __$$module$$__.module = DeviceRuntimeCore.WatchFace({
        onInit() {
            build()
        },
        onDestroy() {
            timerId && timer.stopTimer(timerId)
        }
    })
})()
