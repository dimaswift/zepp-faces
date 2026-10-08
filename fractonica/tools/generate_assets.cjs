#!/usr/bin/env node
'use strict'

// Prerender the Fractonica phase glyphs, counter dots and Greek period
// letters as pixel-aligned PNGs:
//   teal_<0..15>  two-stroke period glyphs (clock.glyphSVG strokes)
//   sun_<0..51>   three-stroke solar glyphs (CBT strokes, depth 3)
// Strokes come verbatim from fractonica.js; this script re-frames, recolours
// and rasterises them, and places the derivative dot by the face's own rule
// (glyphState in watchface/index.js: dotted on the falling branch).
//
//   node tools/generate_assets.cjs [--fractonica path/to/fractonica.js]
//
// Requires rsvg-convert and ImageMagick (magick) on PATH.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const model = require('../watchface/index.js')

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
const VIEW_H = { 2: 9.0, 3: 12.0 } // two or three strokes
const GLYPH_W = Math.round(VIEW_W * UNIT)
const DOT_RADIUS = 3

const TEAL = { on: '#4FD1C5', off: '#1E4F4A' }
const YELLOW = '#FFD60A'

const LETTER_FONT = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
const LETTER_W = 20
const LETTER_H = 28
const LETTER_POINTS = 24
const SUB_W = 9
const SUB_H = 14
const SUB_POINTS = 13

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

function reframeGlyph(svg, strokes, color, dot) {
    const source = /stroke="([^"]+)"/.exec(svg)[1]
    const height = VIEW_H[strokes]
    return svg
        .replace(/<title>.*?<\/title>/, '')
        .replace(/<circle [^>]*\/>/, '')
        .replace('</svg>', (dot || '') + '</svg>')
        .replace(/ width="[^"]*"/, ` width="${GLYPH_W}"`)
        .replace(/ height="[^"]*"/, ` height="${Math.round(height * UNIT)}"`)
        .replace(/ viewBox="[^"]*"/, ` viewBox="${VIEW_X} ${VIEW_Y} ${VIEW_W} ${height}"`)
        .split(source).join(color)
}

function dotSvg(color) {
    const c = model.DOT_SIZE / 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${model.DOT_SIZE}" height="${model.DOT_SIZE}">`
        + `<circle cx="${c}" cy="${c}" r="${DOT_RADIUS}" fill="${color}"/></svg>`
}

function renderText(text, w, h, points, color, file) {
    execFileSync('magick', ['-size', `${w}x${h}`, 'xc:none', '-font', LETTER_FONT,
        '-pointsize', String(points), '-fill', color, '-gravity', 'center',
        '-annotate', '+0+0', text, '-depth', '8', file])
}

// Store preview: the face as it looked at a fixed instant (default depths).
function writePreview(dir) {
    const width = 192
    const height = 490
    const layout = model.layoutFor(width, height)
    const tt = model.ttFromUtcMilliseconds(Date.parse('2026-10-08T12:00:00Z'))
    const position = model.positionAt(tt)
    const solar = model.solarAt(tt)
    const args = ['-size', `${width}x${height}`, 'xc:black']
    const place = (file, at) => args.push(path.join(dir, file), '-geometry', `+${at.x}+${at.y}`, '-composite')
    const half = model.DOT_SIZE >> 1
    for (let i = 0; i < 2; i++) {
        const phase = model.phaseAt(position, model.DEFAULT_TOP_DEPTH - 1 + i)
        const sub = model.subPhaseAt(position, model.DEFAULT_TOP_DEPTH - 1 + i)
        place(`teal_${phase.index}.png`, layout.periodGlyphs[i][0])
        place(`teal_${sub.sub}.png`, layout.periodGlyphs[i][1])
        model.arcDotCenters(layout.arcs[i], phase.siblings).forEach((c, k) =>
            place(`teal_dot_${k <= phase.local ? 'on' : 'off'}.png`, { x: c.x - half, y: c.y - half }))
    }
    solar.digits.forEach((state, i) => place(`sun_${state}.png`, layout.solarGlyphs[i]))
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

    // Two strokes: clock.glyphSVG at the middle of each of the 16 bins.
    const period = []
    for (let index = 0; index < 16; index++) {
        const position = F.rational(BigInt(2 * index + 1), 2n * units)
        const phase = clock.phaseAt(position, level)
        const state = model.glyphState(index, 4)
        if (Number(phase.index) !== index || Number(phase.value) !== state.value) {
            throw new Error(`phase bin mismatch at ${index}`)
        }
        period.push({ index, svg: clock.glyphSVG(position, level), state })
    }
    // The library's derivative dot (same position for any depth), from bin 0.
    const dot = /<circle [^>]*\/>/.exec(period[0].svg)[0]

    // Solar glyphs: CBT scalar glyphs with the face's SOLAR_STROKES strokes
    // (two strokes: the same drawings as the period glyphs).
    const solar = []
    for (let index = 0; index < model.SOLAR_STATES; index++) {
        const state = model.glyphState(index, model.SOLAR_EXTREME)
        const svg = model.SOLAR_STROKES === 2
            ? period[index].svg
            : F.CBT.fromScalar(state.value, { depth: model.SOLAR_STROKES }).toSVG()
        solar.push({ index, svg, state })
    }

    const blank = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
    for (const out of OUTPUT_DIRS) {
        const dir = path.join(out, 'fx')
        fs.rmSync(dir, { recursive: true, force: true })
        fs.mkdirSync(dir, { recursive: true })
        for (const glyph of period) {
            rasterise(reframeGlyph(glyph.svg, 2, TEAL.on, glyph.state.dotted ? dot : ''),
                path.join(dir, `teal_${glyph.index}.png`))
        }
        for (const glyph of solar) {
            rasterise(reframeGlyph(glyph.svg, model.SOLAR_STROKES, YELLOW, glyph.state.dotted ? dot : ''),
                path.join(dir, `sun_${glyph.index}.png`))
        }
        rasterise(dotSvg(TEAL.on), path.join(dir, 'teal_dot_on.png'))
        rasterise(dotSvg(TEAL.off), path.join(dir, 'teal_dot_off.png'))
        rasterise(blank, path.join(dir, 'blank.png'))
        model.GREEK.forEach((letter, i) =>
            renderText(letter, LETTER_W, LETTER_H, LETTER_POINTS, TEAL.on, path.join(dir, `greek_${i}.png`)))
        for (let digit = 0; digit < 10; digit++) {
            renderText(String(digit), SUB_W, SUB_H, SUB_POINTS, TEAL.on, path.join(dir, `sub_${digit}.png`))
        }
    }

    writePreview(path.join(ROOT, 'assets/fx'))

    const show = (list) => list.map((g) => g.state.value + (g.state.dotted ? '•' : '')).join(' ')
    console.log(`teal: ${show(period)}`)
    console.log(`sun:  ${show(solar)}`)
    console.log(`(fractonica ${library})`)
}

main()
