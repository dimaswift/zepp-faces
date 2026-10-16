#!/usr/bin/env node
'use strict'

// Prerender the journal face's images (the fractonica-clock browser face, src/ui/face/journal.js),
// in the browser's level colours (theme.levelColor: hsl(levelHue, 68 %, 64 %)):
//   j2_<L>_<0..15>   two-stroke glyphs of the minor units ε η ι λ ν (L = 4 6 8 10 12)
//   j3_<L>_<0..51>   three-stroke glyphs of the major periods α β γ δ (L = 0 1 2 3)
//   jl_<L>           the unit's letter (20 × 28), for every unit
//   jc_d<0..9>       digits of the middle reading (14 × 28, white), jc_u<L> the unit letters, jc_hash '#'
//   jarc_<L>         the cycle as two half-arcs (left descending, right ascending) with its quarter dots
//   jdot             the tick on the arc
// Only these files are written (the rest of fx/ is left alone).
//
//   node tools/generate_journal_assets.cjs [--fractonica path/to/fractonica.js]
//
// Requires rsvg-convert and ImageMagick (magick) on PATH.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const model = require('../watchface/index.js')

const ROOT = path.resolve(__dirname, '..')
const DEFAULT_LIBRARY = [path.resolve(ROOT, '../../fractonica-clock/fractonica-2.0.0.js'), path.resolve(ROOT, '../../fractonica-clock/fractonica.js')].find(fs.existsSync)
const OUTPUT_DIRS = [path.join(ROOT, 'assets/fx'), path.join(ROOT, 'assets/sb7/fx')]

// Same framing as tools/generate_assets.cjs: 10 px per CBT unit, the 0.3-unit stroke is 3 px.
const UNIT = 10
const VIEW_X = -2.65
const VIEW_Y = -2.45
const VIEW_W = 5.3
const VIEW_H = { 2: 9.0, 3: 12.0 }
const GLYPH_W = Math.round(VIEW_W * UNIT)

// theme.levelColor of the units (fractonica-clock src/core/theme.js)
const COLOR = { 0: '#9F65E2', 1: '#7A65E2', 2: '#6578E2', 3: '#659DE2', 4: '#65C2E2', 6: '#65E2B4', 8: '#65E269', 10: '#AEE265', 12: '#E2C965' }
const WHITE = '#E8EEF3'
const LETTER_FONT = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
const CHAR_FONT = 'Menlo-Bold'
const CHAR_W = 14
const CHAR_H = 28
const CHAR_POINTS = 22
const ARC = { w: 160, h: 86, r: 38 }

function loadFractonica(file) {
    const sandbox = { module: { exports: {} }, console, BigInt, Intl, Date }
    sandbox.globalThis = sandbox
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file })
    return sandbox.module.exports
}

function rasterise(svg, file) {
    const tmp = path.join(os.tmpdir(), 'fractonica-journal-' + process.pid + '.svg')
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

function renderText(text, w, h, points, color, font, file) {
    execFileSync('magick', ['-size', `${w}x${h}`, 'xc:none', '-font', font,
        '-pointsize', String(points), '-fill', color, '-gravity', 'center',
        '-annotate', '+0+0', text, '-depth', '8', file])
}

function arcSvg(color) {
    const { w, h, r } = ARC
    const cy = h / 2
    const x0 = w / 2 - 2 * r
    const x1 = w / 2 + 2 * r
    const dots = [0, 0.25, 0.5, 0.75, 1].map((f) => {
        const p = model.journalArcPoint(f, w / 2, cy, r)
        return `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.6" fill="${color}" fill-opacity="0.6"/>`
    }).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
        + `<line x1="${x0 - 4}" y1="${cy}" x2="${x1 + 4}" y2="${cy}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>`
        + `<path d="M${x0} ${cy}A${r} ${r} 0 0 0 ${w / 2} ${cy}A${r} ${r} 0 0 1 ${x1} ${cy}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`
        + dots + '</svg>'
}

function generateJournal(F, dirs = OUTPUT_DIRS) {
    const clock = F.create()
    const level = 6
    const units = clock.prefix(level) * 4n
    const two = []
    for (let index = 0; index < 16; index++) {
        const position = F.rational(BigInt(2 * index + 1), 2n * units)
        two.push({ index, svg: clock.glyphSVG(position, level), state: model.glyphState(index, 4) })
    }
    const dot = /<circle [^>]*\/>/.exec(two.find((g) => /<circle /.test(g.svg)).svg)[0]
    const three = []
    for (let index = 0; index < 52; index++) {
        const state = model.glyphState(index, 13)
        three.push({ index, svg: F.CBT.fromScalar(state.value, { depth: 3 }).toSVG(), state })
    }
    for (const dir of dirs) {
        fs.mkdirSync(dir, { recursive: true })
        for (const L of [4, 6, 8, 10, 12]) {
            for (const g of two) rasterise(reframeGlyph(g.svg, 2, COLOR[L], g.state.dotted ? dot : ''), path.join(dir, `j2_${L}_${g.index}.png`))
        }
        for (const L of [0, 1, 2, 3]) {
            for (const g of three) rasterise(reframeGlyph(g.svg, 3, COLOR[L], g.state.dotted ? dot : ''), path.join(dir, `j3_${L}_${g.index}.png`))
        }
        for (const L of model.JOURNAL_UNITS) {
            renderText(model.JOURNAL_LETTERS[L], 20, 28, 24, COLOR[L], LETTER_FONT, path.join(dir, `jl_${L}.png`))
            rasterise(arcSvg(COLOR[L]), path.join(dir, `jarc_${L}.png`))
        }
        for (let d = 0; d < 10; d++) renderText(String(d), CHAR_W, CHAR_H, CHAR_POINTS, WHITE, CHAR_FONT, path.join(dir, `jc_d${d}.png`))
        for (const L of [4, 6, 8, 10, 12]) renderText(model.JOURNAL_LETTERS[L], CHAR_W, CHAR_H, CHAR_POINTS, COLOR[L], CHAR_FONT, path.join(dir, `jc_u${L}.png`))
        renderText('#', CHAR_W, CHAR_H, CHAR_POINTS, COLOR[4], CHAR_FONT, path.join(dir, 'jc_hash.png'))
        rasterise('<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11"><circle cx="5.5" cy="5.5" r="4" fill="#ffffff" stroke="#04070a" stroke-width="1"/></svg>', path.join(dir, 'jdot.png'))
    }
    return two.length * 5 + three.length * 4
}

module.exports = { generateJournal, COLOR, CHAR_W, CHAR_H, ARC }

if (require.main === module) {
    const flag = process.argv.indexOf('--fractonica')
    const library = flag > 0 ? path.resolve(process.argv[flag + 1]) : DEFAULT_LIBRARY
    const n = generateJournal(loadFractonica(library))
    console.log(`journal: ${n} glyphs per output dir (fractonica ${library})`)
}
