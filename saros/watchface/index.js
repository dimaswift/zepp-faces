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

    const Screen = {
        Top: 0,
        Mid: 1,
        Bottom: 2
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
    
     const rotations = [
            [0, 4, 1, 6], [0, 4, 2, 5], [0, 4, 3, 7], 
            [1, 6, 0, 4], [1, 6, 2, 5], [1, 6, 3, 7], 
            [2, 5, 0, 4], [2, 5, 1, 6], [2, 5, 3, 7],
            [3, 7, 0, 4], [3, 7, 1, 6], [3, 7, 2, 5]
        ]
    const ORGX = [0, 4, 4, 0];
    const ORGY = [0, 0, 4, 4];


    let SAROS = [
        [1263539259000, 1832512139000, 2401484786000, 2970457223000, 3539418443000, 4108400891000 ],
        [1306963038000, 1875931573000, 2444899951000, 3013868032000, 3582836063000 ],
        [1337558034000, 1906525753000, 2475493133000, 3044460348000, 3613427546000, 4182394514000 ]
    ]
    let heart = null
    let time = null
    let battery = null
    let vibrate = null
    let lastClick = 0
    let clickSequence = ''
    let step = null
    let COLOR_FG = 0xFFFFFF
    let timerId = null
    let mode = 0
    const MODE_COUNT = 3
    let maxBins8 = Math.pow(8, 12)
    let screens = []
    let drawnBin = 0
    let next = null
    let nextSaros = 0
    let commands = []
    let current = 0
    let screenWidth = 0
    let debugTexts = []
    let debugBtns = []
    let screenHeight = 0
    let heartTicks = 0
    let heartMin = 50
    let heartMax = 120
    let lastStatUpdate = 0
    let radix = 8
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

    function drawGlyph(n, d, op, screen, color) {
        const quadIdx = d & 3;
        const baseX = ORGX[quadIdx];
        const baseY = ORGY[quadIdx];
        const m = glyphMask(n);
        
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                const { ox, oy } = applyOp4(x, y, op);
                screen(baseX + ox, baseY + oy, m & (1 << (y * 4 + x)) ? color : 0x000000);
            }
        }
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

    function triggerVibration() {
        vibrate.stop();
        vibrate.scene = 23
        vibrate.start()
    }

    function handleCommand() {

        if(commands[clickSequence] != null) {
            commands[clickSequence]();
            clickSequence = ''
            lastClick = 0
        }
    }

    function cycleSaros() {
      
        current++
        if(current >= SAROS.length) {
            current = 0
        }
        tick()
    }

       
    function addCmd(seq, cmd) {
        commands[seq] = cmd
    }

    function addScreen(offsetY) {
       
        let screen = []
        const OFFSET_Y = 54
        const margin = 1
        const pixelSize = (screenWidth / WIDTH) / 2
        const offsetX = pixelSize * 4
        for (let x = 0; x < WIDTH; x++) { 
            screen[x] = []
             for (let y = 0; y < WIDTH; y++) {
                screen[x][y] = drawRect(offsetX + x * pixelSize + 1,y * pixelSize + (OFFSET_Y + offsetY * pixelSize), pixelSize - margin, pixelSize - margin, COLOR_FG)
             }  
        }
        screens.push(screen)
    }

    function onHeartChanged() {

    }

    function getSarosBin() {
        const now = time.utc

        if (now > nextSaros) {
            next = findClosest(SAROS[current], now)
            nextSaros = SAROS[current][next.future_index]
        }
        
        return findBin(now, next, SAROS[current])
    }

    function setMode(m) {
        debugTexts.forEach(t => {
            t.setProperty(hmUI.prop.VISIBLE, m == 3)
        });
        debugBtns.forEach(t => {
            t.setProperty(hmUI.prop.VISIBLE, m == 3)
        });
        mode = m
        tick()
       
    }

    function addDebugText() {
        const t = hmUI.createWidget(hmUI.widget.TEXT, {
            x: 8,
            y: 180 + debugTexts.length * 32,
            w: screenWidth - 4,
            h: 22,
            color: 0xffffff,
            text_size: 24,
            align_h: hmUI.align.LEFT_H,
            align_v: hmUI.align.CENTER_V,
            text_style: hmUI.text_style.NONE,
            text: ''
        }) 

        debugTexts.push(t)
        
    }

    function build() {


        const deviceInfo = hmSetting.getDeviceInfo()
        screenWidth = deviceInfo.width
        screenHeight = deviceInfo.height
        addCmd('012', cycleSaros)
        addCmd('000', () => setMode(0))
        addCmd('111', () => setMode(1))
        addCmd('222', () => setMode(2))
        addCmd('202', () => setMode(3))
        heart = hmSensor.createSensor(hmSensor.id.HEART)
        battery = hmSensor.createSensor(hmSensor.id.BATTERY)
        step = hmSensor.createSensor(hmSensor.id.STEP)
        vibrate = hmSensor.createSensor(hmSensor.id.VIBRATE)
        time = hmSensor.createSensor(hmSensor.id.TIME)
      
        heart.addEventListener(heart.event.CURRENT, onHeartChanged)


        addScreen(0)
        addScreen(12)
        addScreen(24)

        
        addDebugText()
        addDebugText()
        addDebugText()
        addDebugText()
        addDebugText()

        heartMax = hmFS.SysProGetInt('saros_heart_max')
        heartMin = hmFS.SysProGetInt('saros_heart_min')

        if(!heartMax) heartMax = 120
        if(!heartMin) heartMin = 50
        
        let btn = hmUI.createWidget(hmUI.widget.STROKE_RECT, {
            x: 0,
            y: 0,
            w: screenWidth,
            h: screenHeight,
            radius: 0,
            color: 0x000000
        })

        debugBtns.push(hmUI.createWidget(hmUI.widget.BUTTON, {
            x: 4,
            y: 370,
            text: 'RADIX',
            w: screenWidth - 8,
            h: 60,
            color: 0x000000,
            normal_color: COLOR_FG,
            click_func: () => {
                if(radix == 10) radix = 4
                radix *= 2
                if(radix > 64) radix = 8
                tick()
            }
        }))

        debugBtns.push(hmUI.createWidget(hmUI.widget.BUTTON, {
            x: 4,
            y: 434,
            text: 'DECIMAL',
            w: screenWidth - 8,
            h: 60,
            color: 0x000000,
            normal_color: COLOR_FG,
            click_func: () => {
                radix = 10
                tick()
            }
        }))
  
        btn.addEventListener(hmUI.event.CLICK_DOWN, (info) => {

            

            if (clickSequence.length > 1 && time.utc - lastClick > 1000) {
                clickSequence = ''
            }

            lastClick = time.utc

            if(info.y < screenHeight / 3) {
                clickSequence += '0'
            }
            else if(info.y < screenHeight / 1.5) {
               clickSequence += '1'
            }
            else {
                clickSequence += '2'
            }

            if(clickSequence.length > 1) {
                handleCommand()
            }
        })
       
        time.addEventListener(time.event.MINUTEEND, () => {
             const bin = Math.floor(getSarosBin() / 2097152)
             const last = hmFS.SysProGetInt('saros_last')
             if (bin != last) {
                hmFS.SysProSetInt('saros_last', bin)
                triggerVibration()
             }
        })
        
        setMode(3)
    }

    function screenHandler(index, x, y, color) {
        screens[index][x][y].setProperty(hmUI.prop.COLOR, color)
    }

    function draw(bin, orientation, screen, color) { 

        drawGlyph((bin >> 9) % 8, 0, rotations[orientation % 12][0], (x,y,c) => screenHandler(screen, x,y,c), color);
        drawGlyph((bin >> 6) % 8, 1, rotations[orientation % 12][1], (x,y,c) => screenHandler(screen, x,y,c), color);
        drawGlyph((bin >> 3) % 8, 2, rotations[orientation % 12][2], (x,y,c) => screenHandler(screen, x,y,c), color);
        drawGlyph((bin >> 0) % 8, 3, rotations[orientation % 12][3], (x,y,c) => screenHandler(screen, x,y,c), color);
    }

    function drawSaros() {
        
        const bin = getSarosBin()

        if (bin != drawnBin) {
            const node = (bin >> 24) % 8
    
            draw(Math.floor(bin / 16777216), node, Screen.Top, COLOR_FG)
            draw(Math.floor(bin / 4096), node, Screen.Mid, COLOR_FG)
            draw(bin, node, Screen.Bottom, COLOR_FG) 

            drawnBin = bin 
        }
        
    }

    function drawStats() {
        let batteryBin = Math.floor(4095 * (1.0 - (battery.current / 100)))
        draw(batteryBin, 1, Screen.Top, 0x38f2ff)
        draw(time.utc / 1000, 1, Screen.Mid, 0xff3838)
        draw(step.current, 1, Screen.Bottom,0x77ff38)
    }

    function mapRange(value, inMin, inMax, outMin, outMax) {
        const t = (value - inMin) / (inMax - inMin);
        const tc = Math.min(1, Math.max(0, t));
        return outMin + tc * (outMax - outMin);
    }

    function debugLog(index, txt, color) {
        if(!color) color = COLOR_FG
        debugTexts[index].setProperty(hmUI.prop.MORE, {
            text: txt,
            color: color
        })
    }

    function drawDebug() {
        const sec = Math.floor(time.utc / 1000)
        draw(0, 1, Screen.Top, 0x000000)
        draw(0, 1, Screen.Mid, 0x000000)
        draw(0, 1, Screen.Bottom,0x000000)

        debugLog(0, "B: " + Math.floor(getSarosBin() / 4095).toString(radix))
        debugLog(1, "U: " + sec.toString(radix))
        debugLog(2, "H: " + heart.current.toString(radix) + " (" + heartMin.toString(radix) + ":" + heartMax.toString(radix) + ")")
        debugLog(3, "S: " + step.current.toString(radix))
    }

    function drawHeart() {
        let rate = heart.current != null ? heart.current : heart.last
        let statUpdateRate = Math.floor((60 / rate) * 1000)
       
        if (time.utc - lastStatUpdate < statUpdateRate) {
            return
        }
        lastStatUpdate = time.utc
        heartTicks += rate
        if (heartTicks > 4095) heartTicks = 0

        if(rate > heartMax) {
            heartMax = rate
            hmFS.SysProSetInt('saros_heart_max', heartMax)
  
        }

        if(rate < heartMin) {
            heartMin = rate
            hmFS.SysProSetInt('saros_heart_min', heartMin)
        }

        draw(rate, 0, Screen.Top, 0xff3838)

        draw(heartTicks, 1, Screen.Mid, 0xff3838)

        let heartBin = mapRange(rate, heartMin, heartMax, 0, 4095)
      
        draw(Math.floor(heartBin), 2, Screen.Bottom, 0xff3838)
    }

    function tick() {

  
        switch (mode) {
            case 0:
                drawSaros()     
                break;
            case 1:
                drawStats()
                break;
            case 2:
                drawHeart()
                break;
            case 3:
                drawDebug()
                break;
            default:
                break;
        }
    }

    function entrypoint() {

        build()
        
        tick() 
        
		timerId = timer.createTimer(0, 530, () => {
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
            heart && heart.removeEventListener(heart.event.CURRENT, onHeartChanged)
        }
    })
})()
