#!/usr/bin/env node
'use strict'

// Prerender the 16 two-stroke Fractonica phase glyphs and the period dots as
// pixel-aligned PNGs. Glyph geometry comes verbatim from fractonica.js
// (clock.glyphSVG); this script only re-frames, recolours and rasterises it.
//
//   node tools/generate_assets.cjs [--fractonica path/to/fractonica.js]
//
// Requires rsvg-convert and ImageMagick (magick) on PATH.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const DEFAULT_LIBRARY = path.resolve(ROOT, '../../fractonica-clock/fractonica.js')
const OUTPUT_DIRS = [path.join(ROOT, 'assets'), path.join(ROOT, 'assets/sb7')]

// One CBT grid unit is exactly ten pixels and the library stroke (0.3 units)
// is exactly three. Grid lines sit on whole units, and the frame origin
// below puts x = 0 and y = 0 on pixel centres, so every straight stroke
// covers whole pixels and only curves receive anti-aliasing.
const UNIT = 10
const VIEW_X = -2.65
const VIEW_Y = -2.45
const VIEW_W = 5.3
const VIEW_H = 9.0
const GLYPH_W = Math.round(VIEW_W * UNIT)
const GLYPH_H = Math.round(VIEW_H * UNIT)
const DOT_SIZE = 7
const DOT_RADIUS = 3

const COLORS = {
    teal: { on: '#4FD1C5', off: '#1E4F4A' },
    yellow: { on: '#FFD60A', off: '#5C4D04' }
}

function loadFractonica(file) {
    const sandbox = { module: { exports: {} }, console, BigInt, Intl, Date }
    sandbox.globalThis = sandbox
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file })
    return sandbox.module.exports
}

function rasterise(svg, file) {
    const tmp = path.join(os.tmpdir(), 'fractonica-asset-' + process.pid + '.svg')
    fs.writeFileSync(tmp, svg)
    execFileSync('rsvg-convert', ['--format', 'png', '-o', file, tmp])
    fs.unlinkSync(tmp)
}

function reframeGlyph(svg, color) {
    const source = /stroke="([^"]+)"/.exec(svg)[1]
    return svg
        .replace(/<title>.*?<\/title>/, '')
        .replace(/ width="[^"]*"/, ` width="${GLYPH_W}"`)
        .replace(/ height="[^"]*"/, ` height="${GLYPH_H}"`)
        .replace(/ viewBox="[^"]*"/, ` viewBox="${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}"`)
        .split(source).join(color)
}

function dotSvg(color) {
    const c = DOT_SIZE / 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${DOT_SIZE}" height="${DOT_SIZE}">`
        + `<circle cx="${c}" cy="${c}" r="${DOT_RADIUS}" fill="${color}"/></svg>`
}

// Store preview: the face as it looked at a fixed instant (default depths).
function writePreview(dir) {
    const model = require('../watchface/index.js')
    const { GLYPH_STEM_X, GLYPH_CENTER_Y, DOT_SIZE, RING_SPACING } = model.layout
    const width = 192
    const height = 490
    const tt = model.ttFromUtcMilliseconds(Date.parse('2026-10-08T12:00:00Z'))
    const position = model.positionAt(tt)
    const solar = model.solarAt(tt)
    const cx = width / 2
    const cy = Math.floor(height / 2)
    const rings = [
        { cy: cy - RING_SPACING, color: 'teal', phase: model.phaseAt(position, model.DEFAULT_TOP_DEPTH - 1) },
        { cy: cy + RING_SPACING, color: 'teal', phase: model.phaseAt(position, model.DEFAULT_TOP_DEPTH) },
        { cy: cy, color: 'yellow', phase: { index: solar.index, local: solar.day, siblings: 4 } }
    ]
    const args = ['-size', `${width}x${height}`, 'xc:black']
    const place = (file, x, y) => args.push(path.join(dir, file), '-geometry', `+${x}+${y}`, '-composite')
    for (const ring of rings) {
        place(`${ring.color}_${ring.phase.index}.png`, cx - GLYPH_STEM_X, ring.cy - GLYPH_CENTER_Y)
        model.ringDotCenters(cx, ring.cy, ring.phase.siblings).forEach((c, k) => {
            const state = k < ring.phase.local ? 'on' : 'off'
            place(`${ring.color}_dot_${state}.png`, c.x - (DOT_SIZE >> 1), c.y - (DOT_SIZE >> 1))
        })
    }
    for (const file of [path.join(ROOT, 'preview_sb7.png'), path.join(ROOT, 'assets/sb7/preview_sb7.png')]) {
        execFileSync('magick', [...args, '-depth', '8', file])
    }
}

function main() {
    const flag = process.argv.indexOf('--fractonica')
    const library = flag > 0 ? path.resolve(process.argv[flag + 1]) : DEFAULT_LIBRARY
    const F = loadFractonica(library)
    const clock = F.create()
    const level = 6
    const units = clock.prefix(level) * 4n

    const glyphs = []
    for (let index = 0; index < 16; index++) {
        // Middle of phase bin `index` in the first level-6 cycle.
        const position = F.rational(BigInt(2 * index + 1), 2n * units)
        const phase = clock.phaseAt(position, level)
        if (Number(phase.index) !== index) {
            throw new Error(`phase bin mismatch at ${index}`)
        }
        glyphs.push({ index, svg: clock.glyphSVG(position, level), value: Number(phase.value) })
    }

    const blank = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
    for (const out of OUTPUT_DIRS) {
        const dir = path.join(out, 'fx')
        fs.mkdirSync(dir, { recursive: true })
        for (const [name, color] of Object.entries(COLORS)) {
            for (const glyph of glyphs) {
                rasterise(reframeGlyph(glyph.svg, color.on), path.join(dir, `${name}_${glyph.index}.png`))
            }
            rasterise(dotSvg(color.on), path.join(dir, `${name}_dot_on.png`))
            rasterise(dotSvg(color.off), path.join(dir, `${name}_dot_off.png`))
        }
        rasterise(blank, path.join(dir, 'blank.png'))
    }

    writePreview(path.join(ROOT, 'assets/fx'))

    console.log(`${glyphs.length} glyphs, ${GLYPH_W}x${GLYPH_H}px, values `
        + glyphs.map(g => g.value).join(' ') + ` (fractonica ${library})`)
}

main()
