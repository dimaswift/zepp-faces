(() => {
    
    const diamond = [
        {x: 2,y: 2},
        {x: 3,y:1},
        {x: 4,y:2},
        {x: 5,y:3},
        {x: 6,y:4},
        {x: 5,y:5},
        {x: 4,y:6},
        {x: 3,y:7},
        {x: 2,y:6},
        {x: 1,y:5},
        {x: 0,y:4},
        {x: 1,y:3},
    ];
    const size = 18
    const innerDiamond = [
        {x: 3,y:3},
        {x: 4,y:4},
        {x: 3,y:5},
        {x: 2,y:4}
    ];

    let SAROS = [
        [1263539259000, 1832512139000, 2401484786000, 2970457223000, 3539418443000, 4108400891000 ],
        [1306963038000, 1875931573000, 2444899951000, 3013868032000, 3582836063000 ],
        [1337558034000, 1906525753000, 2475493133000, 3044460348000, 3613427546000, 4182394514000 ]
    ]

    let YEARS = [
        1735678800000,1767214800000,1798750800000, 1830286800000, 1861909200000, 1893445200000,1924981200000,1956517200000,1988139600000,2019675600000,2051211600000,2082747600000,2114370000000,2145906000000,2177442000000,2208978000000,2240600400000
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
    let glyphType = 0

    let maxBins8 = Math.pow(8, 12)

    let drawnBin = 0
    let next = null

    let nextSaros = 0
    let nextYear = 0
    let nextYearIndex = null
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
    let canvas = null
    let diamonCanvas = null

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

     function getYearBin() {
        const now = time.utc
        if (now > nextYear) {
            nextYearIndex= findClosest(YEARS, now)
            nextYear = YEARS[nextYearIndex.future_index]
        }
    
        return findBin(now, nextYearIndex, YEARS)
    }

    function setMode(m) {
        debugTexts.forEach(t => {
            t.setProperty(hmUI.prop.VISIBLE, m == 3)
        });
        debugBtns.forEach(t => {
            t.setProperty(hmUI.prop.VISIBLE, m == 3)
        });
        diamonCanvas.setProperty(hmUI.prop.VISIBLE, m != 3)
        mode = m
        canvas.clear()
        tick()
    }

     function addLineToCanvas(c,a,b) {
        c.addLine({data: [a, b ],
            count: 2
        })
    }

    function addDebugText() {
        const t = hmUI.createWidget(hmUI.widget.TEXT, {
            x: 8,
            y: 180 + debugTexts.length * 32,
            w: screenWidth - 4,
            h: 28,
            color: 0xffffff,
            text_size: 24,
            align_h: hmUI.align.LEFT_H,
            align_v: hmUI.align.CENTER_V,
            text_style: hmUI.text_style.NONE,
            text: ''
        }) 

        debugTexts.push(t)
        
    }

    function ImVec2(x,y) {
        return {x:x,y:y}
    }

    function drawNgon(c, center, size, sides) {
        let lines = []
        for (let i = 0; i < sides; i++) {
            
            let angle = (Math.PI * 2) * (i / sides);
            let angleNext = (Math.PI * 2) * ((i + 1) / sides);
            let x = Math.sin(angle);
            let y = Math.cos(angle);
            let xn = Math.sin(angleNext);
            let yn = Math.cos(angleNext);
            lines.push({x: center.x + x * size, y:center.y + y * size})
            lines.push({x: center.x + xn * size, y:center.y + yn * size})
        }
        c.addLine({
            data: lines,
            count: lines.length
        })
    }

    function drawLines(value, position) {

        for (let i = 0; i < 4; ++i) {
            let anchor = ImVec2(position.x + innerDiamond[i].x * size + size, position.y + innerDiamond[i].y * size);
            let prev = anchor;
            let lines = []
            for (let j = 0; j < 3; ++j) {
                let bit = value >> ((3 * i) + j) & 1;
                let d = diamond[i * 3 + j];
                let next = ImVec2(position.x + d.x * size + size, position.y + d.y * size);

            if(glyphType == 0) {
                if (bit) {
                    lines.push(prev);
                    lines.push(next);
                    prev = next;
                }
            }
            else if(glyphType == 1) {
                if (bit) {
                        lines.push(anchor);
                        lines.push(ImVec2(position.x + d.x * size + size, position.y + d.y * size))
                    }
            }

                
            }
            if(lines.length > 0) {
                canvas.addLine({
                    data: lines,
                    count: lines.length
                })
            }
        }
    }

    function addDiamond(c,position) {
        let center = {x: position.x + size * 3 + size, y: position.y + size * 4}

        drawNgon(c, center, size, 4);
    }

    function getCell(i) {
        switch (i) {
            case 0:
                return {x:screenWidth / 2 - size * 4, y:0};
            case 1:
                return {x:screenWidth / 2 - size * 4, y: screenHeight / 2 - size * 4};
            case 2:
                return {x:screenWidth / 2 - size * 4, y: screenHeight - size * 8};
            default:
                return {x:0,y:0}
        }
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
        
        heartMax = hmFS.SysProGetInt('saros_heart_max')
        heartMin = hmFS.SysProGetInt('saros_heart_min')

        if(!heartMax) heartMax = 120
        if(!heartMin) heartMin = 50
        
         canvas = hmUI.createWidget(hmUI.widget.GRADKIENT_POLYLINE, {
            x: 0,
            y: 0,
            w: screenWidth,
            h: screenHeight,
            line_color: 0xFFFFFF,
            line_width: 4
            })

        diamonCanvas = hmUI.createWidget(hmUI.widget.GRADKIENT_POLYLINE, {
            x: 0,
            y: 0,
            w: screenWidth,
            h: screenHeight,
            line_color: 0xFFFFFF,
            line_width: 4
            })
            
        let lineCanvas = hmUI.createWidget(hmUI.widget.GRADKIENT_POLYLINE, {
                x: 0,
                y: 0,
                w: screenWidth,
                h: screenHeight,
                line_color: 0xAAAAAAA,
                line_width: 2
        })

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
             const bin = Math.floor((getSarosBin() - 64) / 16777216)
             const last = hmFS.SysProGetInt('saros_last')
             if (bin != last) {
                hmFS.SysProSetInt('saros_last', bin)
                triggerVibration()
             }
        })


        let c1 = getCell(1)
        let c2 = getCell(2)

       //addLineToCanvas(lineCanvas, {x: 0, y:c1.y - size }, {x: screenWidth, y:c1.y  - size   })
       // addLineToCanvas(lineCanvas, {x: 0, y:c2.y- size }, {x: screenWidth, y:c2.y - size })

        addDiamond(diamonCanvas, getCell(0));
        addDiamond(diamonCanvas, getCell(1));
        addDiamond(diamonCanvas, getCell(2));
        canvas.clear() 

        addDebugText()
        addDebugText()
        addDebugText()
        addDebugText()
        addDebugText()

        setMode(0)
        tick()
    }

    function drawSaros() {
        
        const bin = getSarosBin()
        if (bin != drawnBin) {
             canvas.clear() 
            drawLines(Math.floor(bin / 16777216), getCell(0))
            drawLines(Math.floor(bin / 4096),getCell(1))
            drawLines(bin, getCell(2))
            drawnBin = bin 
        }
        // drawLines(4095, getCell(0))
        //     drawLines(4095,getCell(1))
        //     drawLines(4095, getCell(2))
    }

    function drawYear() {
       const bin = getYearBin()
        if (bin != drawnBin) {
             canvas.clear() 
            drawLines(Math.floor(bin / 16777216), getCell(0))
            drawLines(Math.floor(bin / 4096),getCell(1))
            drawLines(bin, getCell(2))
            drawnBin = bin 
        }
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
        //draw(0, 1, Screen.Top, 0x000000)
       // draw(0, 1, Screen.Mid, 0x000000)
       // draw(0, 1, Screen.Bottom,0x0  00000)
        canvas.clear()
        addDiamond(canvas, getCell(0))
        let batteryBin = Math.floor(4095 * (1.0 - (battery.current / 100)))
        drawLines(batteryBin, getCell(0))
        debugLog(0, "B: " + Math.floor(getSarosBin() / 4096).toString(radix))
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
         canvas.clear()
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

        drawLines(rate, getCell(0), 0xff3838)

        drawLines(heartTicks, getCell(1), 0xff3838)

        let heartBin = mapRange(rate, heartMin, heartMax, 0, 4095)
      
        drawLines(Math.floor(heartBin), getCell(2), 0xff3838)
    }

    function tick() {

  
        switch (mode) {
            case 0:
                drawSaros()     
                break;
            case 1:
                drawYear()
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
