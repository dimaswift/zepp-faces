'use strict'

const assert = require('node:assert/strict')
const model = require('../watchface/index.js')

const anchor = Date.parse('2026-07-15T00:00:00Z') / 1000
const saros141 = model.seriesIndexForSaros(141)

assert.equal(model.BASE_DIGITS, 10)
assert.equal(model.BASE_BIN_COUNT, 1_073_741_824)
assert.equal(model.MIN_SPIKE_REPEAT_LENGTH, 5)
assert.equal(model.SPIKE_PREFIX_DEPTH, 5)
assert.equal(model.MAX_SUPPRESSION_DISTANCE, 64)
assert.equal(model.FORECAST_DOT_COUNT, 4)
assert.equal(model.TOUCH_ZONE_FRACTION, 0.2)
assert.deepEqual(model.touchZoneLayout(490), {
    topY: 0,
    topHeight: 98,
    bottomY: 392,
    bottomHeight: 98
})
assert.equal(model.ARROW_BLINK_MIN_MILLISECONDS, 66)
assert.equal(model.ARROW_BLINK_MAX_MILLISECONDS, 4240)
assert.equal(model.SERIES_COUNT, 40)
assert.equal(model.SAROS_ECLIPSE_SECONDS.length, 120)
assert.deepEqual(model.eclipseTriplet(0), [1_531_450_936, 2_100_421_926, 2_669_393_042])
assert.deepEqual(
    model.eclipseTriplet(saros141),
    [1_263_539_259, 1_832_512_139, 2_401_484_786]
)

for (let index = 0; index < model.SERIES_COUNT; index++) {
    const triplet = model.eclipseTriplet(index)
    assert.ok(triplet[0] < triplet[1] && triplet[1] < triplet[2])
}

const reading141 = model.readingForSeries(saros141, anchor)
assert.equal(reading141.saros, 141)
assert.equal(reading141.address, '7243226416')
assert.equal(reading141.address.slice(0, 5).length, 5)
assert.equal(reading141.address.slice(5).length, 5)

const exactMiddleReading = model.readingForSeries(saros141, model.eclipseTriplet(saros141)[1])
assert.equal(exactMiddleReading.intervalStart, model.eclipseTriplet(saros141)[1])
assert.equal(exactMiddleReading.address, '0000000000')

const next141 = model.nextSpikeForSeries(saros141, anchor, model.SPIKE_PREFIX_DEPTH)
assert.equal(next141.address, '7243233333')
assert.equal(next141.repeatLength, 5)
assert.equal(next141.rarity, 'white')
assert.ok(next141.eventSeconds > anchor)

const afterExactSpike = model.nextSpikeForSeries(
    saros141,
    next141.eventSeconds,
    model.SPIKE_PREFIX_DEPTH
)
assert.ok(afterExactSpike.eventSeconds > next141.eventSeconds)
assert.notEqual(afterExactSpike.address, next141.address)
assert.equal(afterExactSpike.saros, 141)
assert.equal(afterExactSpike.eventSeconds < reading141.intervalEnd, true)

assert.deepEqual(model.rarityForRepeatLength(5), {
    name: 'white', rank: 0, suppressionDistance: 0
})
assert.deepEqual(model.rarityForRepeatLength(6), {
    name: 'blue', rank: 1, suppressionDistance: 8
})
assert.deepEqual(model.rarityForRepeatLength(7), {
    name: 'purple', rank: 2, suppressionDistance: 16
})
assert.deepEqual(model.rarityForRepeatLength(8), {
    name: 'yellow', rank: 3, suppressionDistance: 32
})
assert.deepEqual(model.rarityForRepeatLength(9), {
    name: 'red', rank: 4, suppressionDistance: 64
})
assert.equal(model.rarityForRepeatLength(10).name, 'red')

const middleEclipse = model.eclipseTriplet(saros141)[1]
const justBeforeMiddle = model.nextSpikeForSeries(
    saros141,
    middleEclipse - 0.25,
    model.SPIKE_PREFIX_DEPTH
)
assert.equal(justBeforeMiddle.address, '7777777777')
assert.equal(justBeforeMiddle.rarity, 'red')
assert.equal(justBeforeMiddle.eventSeconds, middleEclipse)
assert.equal(model.readingForSeries(saros141, middleEclipse).address, '0000000000')
assert.equal(model.readingForSeries(saros141, model.eclipseTriplet(saros141)[2]), null)

const closestUpcoming = model.closestUpcomingSpike(anchor, model.SPIKE_PREFIX_DEPTH)
assert.equal(closestUpcoming.saros, 126)
assert.equal(closestUpcoming.address, '7756077777')
assert.equal(closestUpcoming.rarity, 'white')
assert.ok(Math.abs(closestUpcoming.eventSeconds - 1_784_073_829.5825925) < 0.001)

const closest = model.closestSpikeAround(anchor, model.SPIKE_PREFIX_DEPTH)
assert.equal(closest.saros, 143)
assert.equal(closest.address, '5503644444')
assert.equal(closest.rarity, 'white')
assert.ok(Math.abs(closest.eventSeconds - 1_784_073_529.3009346) < 0.001)
assert.ok(closest.eventSeconds < anchor)

const previous141 = model.previousSpikeForSeries(saros141, anchor, model.SPIKE_PREFIX_DEPTH)
assert.equal(previous141.address, '7243222222')
assert.equal(previous141.rarity, 'blue')
assert.ok(previous141.eventSeconds < anchor)

const previousAtExactSpike = model.previousSpikeForSeries(
    saros141,
    next141.eventSeconds,
    model.SPIKE_PREFIX_DEPTH
)
assert.equal(previousAtExactSpike.address, next141.address)
assert.equal(previousAtExactSpike.eventSeconds, next141.eventSeconds)

const seriesState = model.spikeStateForSeries(saros141, anchor, model.SPIKE_PREFIX_DEPTH)
assert.equal(seriesState.spike.address, '7243333333')
assert.equal(seriesState.spike.rarity, 'purple')
assert.equal(seriesState.direction, 'future')
assert.ok(seriesState.validUntilSeconds > anchor)
assert.deepEqual(seriesState.forecast.map(spike => spike.rarity), [
    'white', 'white', 'white', 'white'
])

const globalState = model.globalSpikeState(anchor, model.SPIKE_PREFIX_DEPTH)
assert.equal(globalState.rawSpike.address, '5503644444')
assert.equal(globalState.spike.saros, 118)
assert.equal(globalState.spike.address, '6552555555')
assert.equal(globalState.spike.rarity, 'blue')
assert.equal(globalState.direction, 'past')
assert.ok(globalState.validUntilSeconds > anchor)
assert.deepEqual(globalState.forecast.map(spike => spike.address), [
    '7756077777',
    '7421411111',
    '3076011111',
    '1002422222'
])

function syntheticSpike(repeatLength, eventSeconds, saros = 141) {
    const rarity = model.rarityForRepeatLength(repeatLength)
    return {
        saros,
        repeatLength,
        eventSeconds,
        rarity: rarity.name,
        rarityRank: rarity.rank,
        suppressionDistance: rarity.suppressionDistance
    }
}

function suppressionResult(repeatLength, offset) {
    const rawIndex = 70
    const timeline = Array.from({ length: 141 }, (_, index) => syntheticSpike(5, index * 100))
    timeline[rawIndex + offset] = syntheticSpike(repeatLength, (rawIndex + offset) * 100)
    return model.dominantSpikeForTimeline(timeline, rawIndex, rawIndex * 100 + 50)
}

assert.equal(suppressionResult(6, 8).repeatLength, 6)
assert.equal(suppressionResult(6, 9).repeatLength, 5)
assert.equal(suppressionResult(7, 16).repeatLength, 7)
assert.equal(suppressionResult(7, 17).repeatLength, 5)
assert.equal(suppressionResult(8, 32).repeatLength, 8)
assert.equal(suppressionResult(8, 33).repeatLength, 5)
assert.equal(suppressionResult(9, 64).repeatLength, 9)
assert.equal(suppressionResult(9, -64).repeatLength, 9)
assert.equal(suppressionResult(9, 65).repeatLength, 5)

const equalBarrierTimeline = Array.from({ length: 9 }, (_, index) => syntheticSpike(5, index * 100))
equalBarrierTimeline[0] = syntheticSpike(6, 0)
equalBarrierTimeline[4] = syntheticSpike(6, 400)
assert.equal(model.canSuppressTimelineIndex(equalBarrierTimeline, 0, 8), false)
assert.equal(model.canSuppressTimelineIndex(equalBarrierTimeline, 4, 8), true)
assert.equal(model.dominantSpikeForTimeline(equalBarrierTimeline, 8, 850).eventSeconds, 400)

const higherBarrierTimeline = Array.from({ length: 9 }, (_, index) => syntheticSpike(5, index * 100))
higherBarrierTimeline[0] = syntheticSpike(6, 0)
higherBarrierTimeline[4] = syntheticSpike(7, 400)
assert.equal(model.canSuppressTimelineIndex(higherBarrierTimeline, 0, 8), false)
assert.equal(model.canSuppressTimelineIndex(higherBarrierTimeline, 4, 8), true)
assert.equal(model.dominantSpikeForTimeline(higherBarrierTimeline, 8, 850).rarity, 'purple')

const priorityTimeline = Array.from({ length: 9 }, (_, index) => syntheticSpike(5, index * 100))
priorityTimeline[5] = syntheticSpike(6, 500)
priorityTimeline[6] = syntheticSpike(7, 600)
priorityTimeline[7] = syntheticSpike(8, 700)
priorityTimeline[8] = syntheticSpike(9, 800)
assert.equal(model.dominantSpikeForTimeline(priorityTimeline, 4, 450).rarity, 'red')

const futureDirectionState = model.spikeStateFromNeighbors(
    [syntheticSpike(5, 300)],
    [syntheticSpike(6, 500)],
    450
)
assert.equal(futureDirectionState.spike.rarity, 'blue')
assert.equal(futureDirectionState.direction, 'future')
assert.equal(futureDirectionState.validUntilSeconds, 500)
assert.equal(futureDirectionState.proximityBoundarySeconds, 300)
assert.equal(model.arrowBlinkIntervalMilliseconds(futureDirectionState, 500), 66)
assert.equal(model.arrowBlinkIntervalMilliseconds(futureDirectionState, 400), 2153)
assert.equal(model.arrowBlinkIntervalMilliseconds(futureDirectionState, 300), 4240)
assert.equal(model.arrowBlinkIntervalMilliseconds(futureDirectionState, 0), 4240)

const pastDirectionState = model.spikeStateFromNeighbors(
    [syntheticSpike(6, 400)],
    [syntheticSpike(5, 700)],
    450
)
assert.equal(pastDirectionState.spike.rarity, 'blue')
assert.equal(pastDirectionState.direction, 'past')
assert.equal(pastDirectionState.validUntilSeconds, 550)
assert.equal(pastDirectionState.proximityBoundarySeconds, 700)
assert.equal(model.arrowBlinkIntervalMilliseconds(pastDirectionState, 400), 66)
assert.equal(model.arrowBlinkIntervalMilliseconds(pastDirectionState, 550), 2153)
assert.equal(model.arrowBlinkIntervalMilliseconds(pastDirectionState, 700), 4240)

const redFourthUpcomingState = model.spikeStateFromNeighbors(
    [syntheticSpike(5, 440)],
    [
        syntheticSpike(5, 500),
        syntheticSpike(5, 600),
        syntheticSpike(5, 700),
        syntheticSpike(9, 800)
    ],
    450
)
assert.equal(redFourthUpcomingState.spike.rarity, 'red')
assert.equal(redFourthUpcomingState.direction, 'future')
assert.deepEqual(redFourthUpcomingState.forecast.map(spike => spike.rarity), [
    'white', 'white', 'white', 'red'
])

for (let index = 0; index < model.SERIES_COUNT; index++) {
    const reading = model.readingForSeries(index, anchor)
    const previous = model.previousSpikeForSeries(index, anchor, model.SPIKE_PREFIX_DEPTH)
    const spike = model.nextSpikeForSeries(index, anchor, model.SPIKE_PREFIX_DEPTH)
    assert.ok(previous.eventSeconds <= anchor)
    assert.ok(spike.eventSeconds > anchor)
    assert.ok(spike.repeatLength >= 5)
    assert.equal(spike.address.length, 10)
    assert.equal(reading.address.slice(0, 5) + reading.address.slice(5), reading.address)

    const previousAtSpike = model.previousSpikeForSeries(
        index,
        spike.eventSeconds,
        model.SPIKE_PREFIX_DEPTH
    )
    assert.equal(previousAtSpike.address, spike.address)
    assert.equal(previousAtSpike.eventSeconds, spike.eventSeconds)

    const followingSpike = model.nextSpikeForSeries(
        index,
        spike.eventSeconds,
        model.SPIKE_PREFIX_DEPTH
    )
    assert.ok(followingSpike.eventSeconds > spike.eventSeconds)
    assert.ok(followingSpike.eventSeconds <= reading.intervalEnd)
}

console.log('Saros model tests passed')
