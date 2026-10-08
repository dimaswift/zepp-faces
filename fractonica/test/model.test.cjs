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
assert.deepEqual([atAnchor.sync, atAnchor.day, atAnchor.index, atAnchor.drift], [0, 0, 0, 0])

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
assert.equal(solar.day, Math.floor((now - solar.syncStart) / 86400))
// The sync starts exactly where a depth-7 cycle starts: local index of the
// depth-7 glyph is congruent, bin 0, and solar glyph bin 0.
const startPosition = model.positionAt(solar.syncStart + 0.5)
assert.equal(model.phaseAt(startPosition, level).index, 0)
assert.equal(model.solarAt(solar.syncStart + 0.5).index, 0)
assert.equal(model.solarAt(solar.syncStart + 0.5).day, 0)
assert.equal(model.solarAt(solar.syncStart - 0.5).day, 3)
assert.equal(model.solarAt(solar.syncStart - 0.5).index, 15)

assert.equal(model.midnightClockText(0), '00:00:00')
assert.equal(model.midnightClockText(-10.0224), '23:59:50')
assert.equal(model.midnightClockText(-48445.2), '10:32:35')
// Constant for the whole sync, independent of the instant inside it.
assert.equal(model.solarAt(solar.syncStart + 1).drift, model.solarAt(solar.syncStart + 4 * 86400 - 20).drift)
// One full lap: the drift first passes -86400 s in February 2067.
let lap = model.solarAt(anchor + 1)
while (lap.drift > -86400) lap = model.solarAt(lap.syncStart + 4 * 86400)
assert.equal(new Date((lap.syncStart - model.TT_MINUS_UTC_SECONDS) * 1000).toISOString().slice(0, 7), '2067-02')
// Sync midnights step ~10 s earlier on the wall clock each sync.
const step = (model.solarAt(solar.syncStart + 4 * 86400).syncStart - solar.syncStart) - 4 * 86400
assert.ok(step < -10 && step > -10.2)
assert.equal(model.ringDotCenters(0, 0, 4).length, 3)
assert.deepEqual(model.ringDotCenters(0, 0, 4)[1], { x: 0, y: 60 })

console.log(`ok: ${checked} glyph checks; per-sync drift ${perSyncDrift.toFixed(4)} s; `
    + `now sync #${solar.sync}, day ${solar.day + 1}, midnight at ${model.midnightClockText(solar.drift)}`)
