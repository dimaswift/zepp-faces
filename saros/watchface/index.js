
(() => {
    

     const QuadOp = {
        Identity: 0,
        Rot90: 1,
        Rot180: 2,
        Rot270: 3,
        MirrorX: 4,
        MirrorY: 5,
        MirrorDiag: 6,
        MirrorAntiDiag: 7
    };
    const WIDTH = 8
       
     const bit4 = (x, y) => 1 << (y * 4 + x);

    const STEP_MASKS = [
        bit4(2, 1),
        bit4(1, 1),
        bit4(1, 2),
        bit4(2, 2),
        bit4(3, 0) | bit4(3, 1) | bit4(3, 2),
        bit4(0, 0) | bit4(1, 0) | bit4(2, 0),
        bit4(0, 1) | bit4(0, 2) | bit4(0, 3),
        bit4(1, 3) | bit4(2, 3) | bit4(3, 3),
    ];
    
     const rotations = [//61 40 73 52 
            [0, 4, 1, 6], [0, 4, 2, 5], [0, 4, 3, 7], 
            [1, 6, 0, 4], [1, 6, 2, 5], [1, 6, 3, 7], 
            [2, 5, 0, 4], [2, 5, 1, 6], [2, 5, 3, 7],
            [3, 7, 0, 4], [3, 7, 1, 6], [3, 7, 2, 5]
        ]
      const ORGX = [0, 4, 4, 0];
      const ORGY = [0, 0, 4, 4];

        function glyphMask(n) {
            let clampedN = Math.min(n, 7);
            let m = 0;
            for (let i = 0; i <= clampedN; i++) {
                m |= STEP_MASKS[i];
            }
            return m;
        }

        function applyOp4(x, y, op) {
            switch (op) {
                case QuadOp.Identity:       return { ox: x,     oy: y };
                case QuadOp.Rot90:          return { ox: 3 - y, oy: x };
                case QuadOp.Rot180:         return { ox: 3 - x, oy: 3 - y };
                case QuadOp.Rot270:         return { ox: y,     oy: 3 - x };
                case QuadOp.MirrorX:        return { ox: 3 - x, oy: y };
                case QuadOp.MirrorY:        return { ox: x,     oy: 3 - y };
                case QuadOp.MirrorDiag:     return { ox: y,     oy: x };
                case QuadOp.MirrorAntiDiag: return { ox: 3 - y, oy: 3 - x };
                default:                    return { ox: x,     oy: y };
            }
        }

        function drawGlyph(n, d, color, op, matrix) {
            const quadIdx = d & 3;
            const baseX = ORGX[quadIdx];
            const baseY = ORGY[quadIdx];
            const m = glyphMask(n);

            for (let y = 0; y < 4; y++) {
                for (let x = 0; x < 4; x++) {
                    const { ox, oy } = applyOp4(x, y, op);
                    matrix(baseX + ox, baseY + oy, m & (1 << (y * 4 + x)) ? 0xFFFFFF : 0x000000);
                }
            }
        }

  


    let SAROS = [1263539259000, 1832512139000, 2401484786000, 2970457223000, 3539418443000, 4108400891000 ]
    let percentText = null
    let time = null
    let COLOR_FG = 0xFFFFFF
    let timerId = null

    let maxBins8 = Math.pow(8, 12)
    let topScreen = []
    let bottomScreen = []
    let middleScreen = []

        /**
     * Converts HSV to a 24-bit RGB integer.
     * @param {number} h - Hue (0 - 360)
     * @param {number} s - Saturation (0 - 255)
     * @param {number} v - Value/Brightness (0 - 255)
     * @returns {number} 24-bit integer (0xRRGGBB)
     */
    function hsvToRgb(h, s, v) {
        s /= 255;
        v /= 255;

        const i = Math.floor(h / 60) % 6;
        const f = h / 60 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        let r, g, b;

        switch (i) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }

        // Scale to 0-255 and pack into a single 24-bit integer
        const R = Math.round(r * 255);
        const G = Math.round(g * 255);
        const B = Math.round(b * 255);

        return (R << 16) | (G << 8) | B;
    }
   
        /**
     * @param {BigInt[]|number[]} timestamps - Sorted array of timestamps
     * @param {BigInt|number} target - The timestamp to search for
     */
    function findClosest(timestamps, target) {
        const result = {
            past_index: 0,
            future_index: 0,
            found_past: false,
            found_future: false
        };

        if (!timestamps || timestamps.length === 0) {
            return result;
        }

        const count = timestamps.length;
        const first = timestamps[0];
        const last = timestamps[count - 1];

        // Case 1: Target is before the start of the array
        if (target < first) {
            result.future_index = 0;
            result.found_future = true;
            result.found_past = false;
            return result;
        }

        // Case 2: Target is after the end of the array
        if (target > last) {
            result.past_index = count - 1;
            result.found_past = true;
            result.found_future = false;
            return result;
        }

        // Case 3: Binary Search
        let left = 0;
        let right = count - 1;

        while (left <= right) {
            // Bitwise OR 0 is a fast way to floor a positive number to an integer
            const mid = (left + (right - left) / 2) | 0;
            const val = timestamps[mid];

            if (val < target) {
                left = mid + 1;
            } else if (val > target) {
                if (mid === 0) {
                    right = 0;
                    break;
                }
                right = mid - 1;
            } else {
                // Exact match found
                result.past_index = mid;
                result.future_index = mid;
                result.found_past = true;
                result.found_future = true;
                return result;
            }
        }

        // Case 4: No exact match, determine boundaries
        if (left < count) {
            result.future_index = left;
            result.found_future = true;
        }

        if (left > 0) {
            result.past_index = left - 1;
            result.found_past = true;
        }

        return result;
    }

    function findBin(now, date, list) {
        
        let from = list[date.past_index]
        let to = list[date.future_index]

        if(now > to) return -1

        let passed = now - from
        let total = to - from 
        let frac = passed / total
        return Math.floor(frac * maxBins8)
    }

    function drawRect(x, y, w, h, color) {
        return hmUI.createWidget(hmUI.widget.FILL_RECT, {
            x: x,
            y: y,
            w: w,
            h: h,
            radius: 0,
            color: color
        })
    }

       
    function build() {

       
       
      
  
        const deviceInfo = hmSetting.getDeviceInfo()
       // vibrate = hmSensor.createSensor(hmSensor.id.VIBRATE)
        const screenWidth = deviceInfo.width
        const screenHeight = deviceInfo.height
        const margin = 2
        time = hmSensor.createSensor(hmSensor.id.TIME)
        const OFFSET_Y = 64
        // percentText = hmUI.createWidget(hmUI.widget.TEXT, {
		// 	x: 0,
        //     y: 50,
        //     w: screenWidth,
        //     h: 240,
		// 	color: COLOR_FG,
		// 	text_size: 32,
		// 	align_h: hmUI.align.CENTER_H,
		// 	align_v: hmUI.align.CENTER_V,
		// 	text_style: hmUI.text_style.NONE,
		// 	text: "7100 7732" 
		// })
      
        const pixelSize = (screenWidth / WIDTH) / 2
        const offsetX = pixelSize * 4
        for (let x = 0; x < WIDTH; x++) {
             topScreen[x] = []
             bottomScreen[x] = []
             middleScreen[x] = []
             for (let y = 0; y < WIDTH; y++) {
                bottomScreen[x][y]= drawRect(offsetX + x * pixelSize,screenHeight - OFFSET_Y - y * pixelSize, pixelSize - margin, pixelSize - margin, COLOR_FG)
                middleScreen[x][y] = drawRect(offsetX + x * pixelSize,screenHeight / 2 - pixelSize * 4 + y * pixelSize, pixelSize - margin, pixelSize - margin, COLOR_FG)
                topScreen[x][y] = drawRect(offsetX + x * pixelSize,OFFSET_Y + y * pixelSize, pixelSize - margin, pixelSize - margin, COLOR_FG)
             }  
        }

    }

    function transformLocal(x, y, op) {
        switch (op) {
            case 0: return { tx: x,     ty: y };     // Identity
            case 1: return { tx: 3 - y, ty: x };     // Rot90
            case 2: return { tx: 3 - x, ty: 3 - y }; // Rot180
            case 3: return { tx: y,     ty: 3 - x }; // Rot270
            case 4: return { tx: 3 - x, ty: y };     // MirrorX
            case 5: return { tx: x,     ty: 3 - y }; // MirrorY
            case 6: return { tx: y,     ty: x };     // MirrorDiag
            case 7: return { tx: 3 - y, ty: 3 - x }; // MirrorAntiDiag
            default: return { tx: x,    ty: y };
        }
    }

    function drawTopPixel(x, y, color) {
       // topScreen[x][y].setProperty(hmUI.prop.VISIBLE, true)
        topScreen[x][y].setProperty(hmUI.prop.COLOR, color) 
    }

    function drawBottomPixel(x, y, color) {
       // bottomScreen[x][y].setProperty(hmUI.prop.VISIBLE, true)
        bottomScreen[x][y].setProperty(hmUI.prop.COLOR, color) 
    }

    function drawMiddlePixel(x, y, color) {
        //middleScreen[x][y].setProperty(hmUI.prop.VISIBLE, true)
        middleScreen[x][y].setProperty(hmUI.prop.COLOR, color) 
    }


    function draw(newMoonBin, nodeBin, apogeeBin, screen) { 

        drawGlyph((newMoonBin >> 9) % 8, 0, 0, rotations[nodeBin % 12][0], screen);
        drawGlyph((newMoonBin >> 6) % 8, 1, 0, rotations[nodeBin % 12][1], screen);
        drawGlyph((newMoonBin >> 3) % 8, 2, 0, rotations[nodeBin % 12][2], screen);
        drawGlyph((newMoonBin >> 0) % 8, 3, 0, rotations[nodeBin % 12][3], screen);
    }
 
    let drawnBin = 0
    let next = null
    let nextSaros = 0
    function tick() {

        const now = time.utc

        if (now > nextSaros) {
            next = findClosest(SAROS, now)
            nextSaros = SAROS[next.future_index]
        }

        const bin = findBin(now, next, SAROS)

        if (bin != drawnBin) {
            const node = Math.round(bin / (4096 * 8))
            draw(Math.round(bin / 16777216), node, 0, drawTopPixel)
            draw(Math.round(bin / 4096), node, 0, drawMiddlePixel)
            draw(bin, node, 0, drawBottomPixel)
            drawnBin = bin 
        }

    }

    function entrypoint() {
        build()
        
        tick() 
        
		timerId = timer.createTimer(0, 16, () => {
            tick()
        })
    }

    var __$$app$$__ = __$$hmAppManager$$__.currentApp
    var __$$module$$__ = __$$app$$__.current
    __$$module$$__.module = DeviceRuntimeCore.WatchFace({
        onInit() {
            entrypoint()
        },
		onDestroy() {
            timerId && timer.stopTimer(timerId)
            vibrate && vibrate.stop()
        }
    })
})()