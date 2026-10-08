'use strict'

// Cross-checks the Number port in watchface/index.js against fractonica.js.
//   node test/model.test.cjs [path/to/fractonica.js]

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const model = require('../watchface/index.js')

const library = path.resolve(process.argv[2] || path.join(__dirname, '../../../fractonica-clock/fractonica.js'))
const sandbox = { module: { exports: {} }, console, BigInt, Intl, Date }
sandbox.globalThis = sandbox
vm.runInNewContext(fs.readFileSync(library, 'utf8'), sandbox, { filename: library })
const F = sandbox.module.exports
const clock = F.create()

assert.deepEqual(model.ECLIPSES_TT, Array.from(F.defaults.timestamps, Number))
for (let level = 0; level < 14; level++) {
    assert.equal(model.prefix(level), Number(clock.prefix(level)))
    if (level > 0) {
        assert.equal(model.siblingCount(level), clock.factorAt(level - 1))
    }
}
assert.equal(model.siblingCount(6), 11) // depth 7
assert.equal(model.siblingCount(7), 9) // depth 8

// UTC -> TT agrees with the library's leap-second model.
const utcMs = Date.parse('2026-10-08T12:00:00Z')
assert.ok(Math.abs(model.ttFromUtcMilliseconds(utcMs) - F.number(F.fromUTC(new Date(utcMs)))) < 1e-6)

// Glyph bin and local index against the exact rational implementation.
// Instants are drawn away from bin edges so float rounding cannot flip them.
let checked = 0
let seed = 12345
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
for (let i = 0; i < 400; i++) {
    const ttSeconds = Math.round(F.number(F.fromUTC(new Date(Date.UTC(1975, 0, 1) + random() * 3.2e12))))
    const exact = clock.positionAt(F.rational(BigInt(ttSeconds)))
    const position = model.positionAt(ttSeconds)
    for (let level = 1; level <= 12; level++) {
        const units = clock.prefix(level) * 4n
        const scaled = exact.numerator * units
        const remainder = Number(scaled % exact.denominator) / Number(exact.denominator)
        if (remainder < 1e-4 || remainder > 1 - 1e-4) {
            continue
        }
        const reference = clock.phaseAt(exact, level)
        const cycleIndex = (scaled / exact.denominator) / 16n
        const phase = model.phaseAt(position, level)
        assert.equal(phase.index, Number(reference.index), `bin, level ${level}, t ${ttSeconds}`)
        assert.equal(phase.local, Number(cycleIndex % BigInt(clock.factorAt(level - 1))), `local, level ${level}`)
        checked++
    }
}
assert.ok(checked > 4000)

// Solar sync: anchor is the 1973-12-24 eclipse, sync = 19 depth-7 cycles.
const anchor = model.ECLIPSES_TT[20]
assert.equal(new Date((anchor - model.TT_MINUS_UTC_SECONDS) * 1000).toISOString().slice(0, 10), '1973-12-24')
const atAnchor = model.solarAt(anchor + 1)
assert.deepEqual([atAnchor.sync, atAnchor.digits, atAnchor.drift], [0, [0, 0, 0], 0])

const level = model.SOLAR_LEVEL
const p = clock.prefix(level)
const syncLength = (k) => F.number(clock.timestampAt(F.rational((625625n + 19n * BigInt(k + 1)) * 4n, p)))
    - F.number(clock.timestampAt(F.rational((625625n + 19n * BigInt(k)) * 4n, p)))
const perSyncDrift = syncLength(0) - 4 * 86400
assert.ok(Math.abs(perSyncDrift - -10.0224) < 1e-3, `per-sync drift ${perSyncDrift}`)

const now = model.ttFromUtcMilliseconds(utcMs)
const solar = model.solarAt(now)
const exactSyncStart = F.number(clock.timestampAt(F.rational((625625n + 19n * BigInt(solar.sync)) * 4n, p)))
assert.ok(Math.abs(solar.syncStart - exactSyncStart) < 1e-3)
assert.ok(solar.syncStart <= now && now - solar.syncStart < 4 * 86400)
const exactSyncEnd = F.number(clock.timestampAt(F.rational((625625n + 19n * BigInt(solar.sync + 1)) * 4n, p)))
assert.ok(Math.abs(solar.syncEnd - exactSyncEnd) < 1e-3)
// Three-glyph odometer: 16^3 steps over the sync period.
assert.deepEqual([model.SOLAR_STROKES, model.SOLAR_DIGITS, model.SOLAR_STATES], [2, 3, 16])
const steps = Math.floor((now - solar.syncStart) / (solar.syncEnd - solar.syncStart) * 4096)
assert.deepEqual(solar.digits, [Math.floor(steps / 256), Math.floor(steps / 16) % 16, steps % 16])
// The sync starts exactly where a depth-7 cycle starts: local index of the
// depth-7 glyph is congruent, bin 0, and solar glyph bin 0.
const startPosition = model.positionAt(solar.syncStart + 0.5)
assert.equal(model.phaseAt(startPosition, level).index, 0)
assert.deepEqual(model.solarAt(solar.syncStart + 0.5).digits, [0, 0, 0])
assert.deepEqual(model.solarAt(solar.syncStart - 0.5).digits, [15, 15, 15])
// Left glyph: 4 states per day (6 h each).
assert.deepEqual(model.solarAt(solar.syncStart + 86400 + 60).digits.slice(0, 1), [4])
// Solar thresholds: quarters of the sync period, about one day each.
const quarter = (solar.syncEnd - solar.syncStart) / 4
assert.deepEqual(model.solarThreshold(model.solarAt(solar.syncStart + 10)),
    { name: 'Peak', tt: solar.syncStart + quarter })
assert.equal(model.solarThreshold(model.solarAt(solar.syncStart + 2.5 * quarter)).name, 'Valley')
assert.equal(model.solarThreshold(model.solarAt(solar.syncEnd - 1)).tt, solar.syncEnd)
assert.ok(Math.abs(quarter - 86400) < 3)

// Sync clock: the anchor eclipse's own time of day (15:02:44 TT, 15:01:35
// with today's TT - UTC) in UTC and in two zones.
assert.equal(model.syncClockText(anchor, 0), '15:01:35')
assert.equal(model.syncClockText(anchor, 3 * 3600), '18:01:35')
assert.equal(model.syncClockText(anchor, -16 * 3600), '23:01:35')
assert.equal(model.syncClockText(solar.syncStart, 0),
    new Date(Math.round(solar.syncStart - model.TT_MINUS_UTC_SECONDS) * 1000).toISOString().slice(11, 19))
// One full lap: the drift first passes -86400 s in February 2067.
let lap = model.solarAt(anchor + 1)
while (lap.drift > -86400) lap = model.solarAt(lap.syncStart + 4 * 86400)
assert.equal(new Date((lap.syncStart - model.TT_MINUS_UTC_SECONDS) * 1000).toISOString().slice(0, 7), '2067-02')
// Sync midnights step ~10 s earlier on the wall clock each sync.
const step = (model.solarAt(solar.syncStart + 4 * 86400).syncStart - solar.syncStart) - 4 * 86400
assert.ok(step < -10 && step > -10.2)

// Next threshold matches fractonica's cycle events (firstPeak, middleNode,
// oppositePeak, end).
const eventNames = { firstPeak: 'Peak', middleNode: 'Node', oppositePeak: 'Valley', end: 'End' }
for (let i = 0; i < 60; i++) {
    const t = Math.round(now + (random() - 0.5) * 3e9)
    for (const level of [1, 4, 6, 7, 9]) {
        const exact = clock.positionAt(F.rational(BigInt(t)))
        const cycle = clock.periodAt(exact, level)
        const next = cycle.events.find((e) => e.name !== 'begin' && F.number(e.time) > t)
        const mine = model.nextThreshold(model.positionAt(t), level)
        assert.equal(mine.name, eventNames[next.name], `threshold name, level ${level}`)
        assert.ok(Math.abs(mine.tt - F.number(next.time)) < 1e-3, `threshold time, level ${level}`)
    }
}

// Offset: trust the watch's wall clock unless it is implausible.
const at = Date.parse('2026-10-08T23:30:00Z')
const wall = (y, mo, d, h, mi, s) => ({ year: y, month: mo, day: d, hour: h, minute: mi, second: s })
assert.equal(model.utcOffsetSeconds(at, wall(2026, 10, 9, 1, 30, 0), 0), 2 * 3600)
assert.equal(model.utcOffsetSeconds(at, wall(2026, 10, 8, 16, 30, 0), 0), -7 * 3600)
assert.equal(model.utcOffsetSeconds(at, wall(2026, 10, 9, 5, 15, 0), 0), 5.75 * 3600)
assert.equal(model.utcOffsetSeconds(at, wall(2022, 8, 25, 9, 30, 45), 10800), 10800) // frozen simulator clock

// Civil dates and threshold text.
assert.deepEqual(model.wallClock(Date.parse('2024-02-29T23:59:59Z') / 1000, 0),
    { days: 19782, year: 2024, month: 2, day: 29, time: '23:59:59' })
assert.equal(model.wallClock(Date.parse('2024-02-29T23:59:59Z') / 1000, 1).day, 1)
const nowUtc = Date.parse('2026-10-08T12:00:00Z') / 1000
const tt = (iso) => Date.parse(iso) / 1000 + model.TT_MINUS_UTC_SECONDS
assert.equal(model.thresholdText({ name: 'Peak', tt: tt('2026-10-08T14:32:05Z') }, nowUtc, 0), 'Peak 14:32:05')
assert.equal(model.thresholdText({ name: 'Node', tt: tt('2026-10-08T22:10:00Z') }, nowUtc, 3 * 3600), 'Node Oct 9 01:10')
assert.equal(model.thresholdText({ name: 'End', tt: tt('2026-12-01T09:00:00Z') }, nowUtc, 0), 'End Dec 1 09:00')

// Period names: depth 1 is alpha; after omega the letters repeat with a suffix.
assert.deepEqual(model.periodName(1), { letter: 0, suffix: '' })
assert.deepEqual(model.periodName(7), { letter: 6, suffix: '' }) // eta
assert.deepEqual(model.periodName(24), { letter: 23, suffix: '' }) // omega
assert.deepEqual(model.periodName(25), { letter: 0, suffix: '1' })
assert.deepEqual(model.periodName(50), { letter: 1, suffix: '2' })
assert.equal(model.GREEK.length, 24)

// Glyph states: 0..m, falling branch dotted, -m, then rising undotted.
const states = (m) => Array.from({ length: 4 * m }, (_, i) => model.glyphState(i, m))
    .map((s) => s.value + (s.dotted ? '•' : '')).join(' ')
assert.equal(states(4), '0 1 2 3 4 3• 2• 1• 0• -1• -2• -3• -4 -3 -2 -1')
for (let i = 0; i < 16; i++) {
    assert.equal(model.glyphState(i, 4).value, Number(clock.phaseAt(F.rational(BigInt(2 * i + 1), 8n), 0).value))
}
assert.deepEqual(model.glyphState(13, 13), { value: 13, dotted: false })
assert.deepEqual(model.glyphState(26, 13), { value: 0, dotted: true })
assert.deepEqual(model.glyphState(39, 13), { value: -13, dotted: false })

// Counter arcs: n dots, symmetric about the centre line, left to right.
const layout = model.layoutFor(192, 490)
const top = model.arcDotCenters(layout.arcs[0], 11)
assert.equal(top.length, 11)
assert.deepEqual(top[5], { x: 96, y: 10 })
for (let k = 0; k < 11; k++) {
    assert.equal(top[k].x + top[10 - k].x, 192)
    assert.equal(top[k].y, top[10 - k].y)
}
const bottom = model.arcDotCenters(layout.arcs[1], 9)
assert.deepEqual(bottom[4], { x: 96, y: 480 })
assert.ok(bottom[0].x < bottom[8].x)
assert.deepEqual(layout.solarGlyphs, [{ x: 6, y: 200 }, { x: 70, y: 200 }, { x: 134, y: 200 }])
assert.deepEqual(layout.periodGlyphs[0], [{ x: 30, y: 35 }, { x: 110, y: 35 }])

// Sub glyph: 16 states inside each major bin, matching fractonica at 16x
// the resolution (level + 16 bins = a level-L cycle split into 256).
for (let i = 0; i < 40; i++) {
    const t = Math.round(now + (random() - 0.5) * 2e8) + 0.5
    for (const level of [6, 7, 9]) {
        const mine = model.subPhaseAt(model.positionAt(t), level)
        const exact = clock.positionAt(F.rational(BigInt(2 * t), 2n))
        const scaled = exact.numerator * clock.prefix(level) * 64n
        const fine = scaled / exact.denominator
        assert.equal(mine.sub, Number(fine % 16n), `sub, level ${level}`)
        assert.equal(model.phaseAt(model.positionAt(t), level).index, Number((fine / 16n) % 16n))
    }
}
assert.deepEqual(layout.letters, [{ x: 96, y: 155 }, { x: 96, y: 335 }])

console.log(`ok: ${checked} glyph checks; per-sync drift ${perSyncDrift.toFixed(4)} s; `
    + `now sync #${solar.sync}, solar ${solar.digits.join('/')}, sync at ${model.syncClockText(solar.syncStart, 0)} UTC`)
