(() => {
    
    const DAY = 86400

    function getPhaseFromEpoch(unixTime, epochTime, periodSeconds, resolution) {

        const dt = (unixTime - epochTime) % periodSeconds
      
        const normalized = dt / periodSeconds;

        const bin = Math.floor(normalized * resolution)

        const progress = (normalized * resolution) - bin

        return { normalized, progress, bin }
    }


    class Glyph {
        constructor(size, thickness) {
            this.x = 0
            this.y = 0
            this.size = size
            this.thickness = thickness
            this.col = 0
            this.row = 0
            this.originX = 18
            this.originY = 64
        }
        draw() {}
        move(x, y) {
            this.setPos(this.x + x, this.y + y)
        }

    }

    class Seg4 extends Glyph {
        
        constructor(size, thickness) {
            super(size, thickness)
            this.segments = []
            this.vocab = [
                0b1000,
                0b1100,
                0b0100,
                0b0101,
                0b0001,
                0b0011,
                0b0010,
                0b1010,
            ]
            for (let i = 0; i < 4; i++) {
                this.segments.push(drawRect(0,0, 0, 0, COLOR_FG))
            }
        }

        draw(digit) {
            for (let i = 0; i < this.segments.length; i++) {
                this.segments[i].setProperty(hmUI.prop.VISIBLE, (this.vocab[digit] & (1 << i)) == 0)
            }
        }
 
        setSegmentPos(index, x, y, vertical) {
            this.segments[index].setProperty(hmUI.prop.MORE, {
                x: this.originX + x,
                y: this.originY + y,
                w: vertical ? this.size : this.thickness,
                h: vertical ? this.thickness : this.size,
            })
        }

        setPos(x,y) {
            this.x = x
            this.y = y 
            this.setSegmentPos(0, x, y, false)
            this.setSegmentPos(1, x, y, true)
            this.setSegmentPos(2, x + this.size - this.thickness, y, false)
            this.setSegmentPos(3, x, y + this.size - this.thickness, true)
        }

        moveToCell(x,y) {
            this.setPos(x * (this.size + this.thickness * 2), y * (this.size + this.thickness * 2)) 
        }
        
    }

    class Seg7 extends Glyph {

        //    1
        //   _ _
        // 0| _ |2
        // 5| 6 |3
        //   ___
        //    4
        static svaperog = [
            0b11001100,//0
            0b10000000,//1
            0b10010000,//2
            0b11010000,//3
            0b10001100,//4
            0b10011000,//5
            0b11000000,//6
            0b11011100,//7
        ]

        static arabic = [
            0b11000000,//0
            0b11110011,//1
            0b10001001,//2
            0b10100001,//3
            0b10110010,//4
            0b10100100,//5
            0b10000100,//6
            0b11110001,//7
            0b10000000,//8
            0b10010000,//9
        ]

        static bin = [
            0b10001100,//0
            0b10001110,//1
            0b11001100,//2
            0b11001110,//3
            0b10011100,//4
            0b10011110,//5
            0b11011100,//6
            0b11011110,//7 
        ]

        static cyclic = [
            0b11001100,//0
            0b11011100,//1
            0b11010000,//2
            0b11110001,//3
            0b11100001,//4
            0b11100011,//5
            0b11000010,//6
            0b11001110,//7
        ]


        constructor(size, thickness) {
            
            super(size, thickness)
            this.segments = []
            this.vocab = Seg7.svaperog
            for (let i = 0; i < 7; i++) {
                this.segments.push(drawRect(0,0,0,0, 0xFFFFFF))
            }
        }

        setVocab(v) {
            this.vocab = v
        }

        draw(digit) {
            if (digit == null || digit < 0 || digit >= this.vocab.length) {
                this.clear()
                return
            }
            for (let i = 0; i < this.segments.length; i++) {
                this.segments[i].setProperty(hmUI.prop.VISIBLE, (this.vocab[digit] & (1 << i)) == 0)
            }
        } 

        clear() {
            for (let i = 0; i < this.segments.length; i++) {
                this.segments[i].setProperty(hmUI.prop.VISIBLE, false)
            }
        }

        setSegmentPos(index, x, y, vertical) {
            this.segments[index].setProperty(hmUI.prop.MORE, {
                x: this.originX + x,
                y: this.originY + y,
                w: vertical ? this.size : this.thickness,
                h: vertical ? this.thickness : this.size,
            })
        }

        setPos(x,y) {
            this.x = x
            this.y = y 
            this.setSegmentPos(0, x, y, false)
            this.setSegmentPos(1, x, y, true)
            this.setSegmentPos(2, x + this.size - this.thickness, y, false)
            this.setSegmentPos(3, x  + this.size - this.thickness, y + this.size - this.thickness, false)
            this.setSegmentPos(4, x, y  + (this.size * 2) - this.thickness * 2, true)
            this.setSegmentPos(5, x, y + this.size - this.thickness, false)
            this.setSegmentPos(6, x, y  + (this.size) - this.thickness, true)
        }

        move(x, y) {
            this.setPos(this.x + x, this.y + y)
        }

        moveToCell(col,row) {
            this.col = col
            this.row = row
            this.setPos(col * (this.size + this.thickness * 2), row * (this.size * 2 + this.thickness * 3))
        }

        setRow(row) {
            this.moveToCell(this.col, row)
        }

        setColumn(col) {
            this.moveToCell(col, this.row)
        }

        setColor(color) {
            this.segments.forEach(s => s.setProperty(hmUI.prop.MORE, {color: color}))
        }

        setOrigin(x,y) {
            this.originX = x
            this.originY = y
            this.setPos(this.x, this.y)
        }
    }

    class Num {

        constructor(glyph, capacity, base, color, epoch) {
            this.epoch = epoch
            this.capacity = capacity
            this.glyphs = []
            this.base = base
            this.lastFlash = 0
            this.flashed = false
            this.maxBins = Math.pow(base, capacity)
            this.color = color
            for (let i = 0; i < capacity; i++) {
                let g = glyph()
                g.moveToCell(capacity - 1 - i, 0)
                this.glyphs.push(g)
            }
        }

        set(value) {
            const bitsPerDigit = Math.log2(this.base)

            if (!Number.isInteger(bitsPerDigit)) {
                throw new Error("Base must be a power of 2 to use bit shifting.")
            }

            const mask = (1 << bitsPerDigit) - 1

            let started = false

            for (let i = this.capacity - 1; i >= 0; i--) {

                const digit = (value >> (i * bitsPerDigit)) & mask

                if (!started) {
                    if (digit === 0) { 
                        this.glyphs[i].clear()
                        continue
                    } else {
                        started = true
                    }
                }

                this.glyphs[i].draw(digit)
            }
        }

        flashLastDigit() {
            this.flashed = !this.flashed
            this.glyphs[0].setColor(this.flashed ? this.color : 0xFFFFFF)
        }

        setVocab(v) {
            this.glyphs.forEach(g => g.setVocab(v))
        }

        setRow(row) {
            this.glyphs.forEach(g => g.setRow(row))
        }

        setOrigin(x,y) {
            this.glyphs.forEach(g => g.setOrigin(x,y))
        }
    }

    const CELL_SIZE = 30
    const FLICKER_MAX_DURATION = 21036 //siderial day / 8^4
    const FLICKER_FLASH_DURATIN = 41 //siderial day / 8^7

    const state = {
        voc: 0
    }

    const anomalistic = new Num(() => new Seg7(CELL_SIZE, 6), 4, 8, 0xffb73b, {
        start: 1764850500,                  
        period: 27.5545499 * DAY,                  
    })

    const day = new Num(() => new Seg7(CELL_SIZE, 6), 4, 8, 0x3ba0ff, {
        start: 1704056400,                  
        period: DAY,                  
    })

    const synodic = new Num(() => new Seg7(CELL_SIZE, 6), 4, 8, 0xff3b3b, {
        start: 1763621220,                  
        period: 29.530588 * DAY,                  
    })

    const year = new Num(() => new Seg7(CELL_SIZE, 6), 4, 8, 0x8cff3b, {
        start: 694566337,                  
        period: 31556925,                  
    })

    const lunstice = new Num(() => new Seg7(CELL_SIZE, 6), 4, 8, 0xb03bff, {
        start: 1762462800,                  
        period: 6793 * DAY,                  
    })

    const trackers = [
        day,
        synodic,
        anomalistic,
        year,
        lunstice
    ]

    const vocabs = [
        Seg7.cyclic,
        Seg7.svaperog,
        Seg7.arabic,
    ]

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

    function  setVocab(v) {
        trackers.forEach(t => {
            t.setVocab(vocabs[v])
        })
    }

    function  handleClick(top) {
        state.voc += top ? - 1 : 1
        if(state.voc < 0) state.voc = vocabs.length - 1
        if(state.voc >= vocabs.length) state.voc = 0
        setVocab(state.voc)
    }

    function build() {
        
        trackers.forEach((v,i) => v.setRow(i))

        const deviceInfo = hmSetting.getDeviceInfo()

        state.time = hmSensor.createSensor(hmSensor.id.TIME)
        setVocab(0)
        hmUI.createWidget(hmUI.widget.STROKE_RECT, {
            x: 0,
            y: 0,
            w: deviceInfo.width,
            h: deviceInfo.height,
            radius: 0
        }).addEventListener(hmUI.event.CLICK_DOWN, (info) => {
      
            handleClick(info.y < deviceInfo.height / 2)
        })
       

        // const lineDatas = [
        //     { x: 0, y: 50 },
        //     { x: 250, y: 250 }
        // ]
        // var widget = hmUI.createWidget(hmUI.widget.GRADKIENT_POLYLINE, {
        //     x: 0,
        //     y: 0,
        //     w: deviceInfo.width,
        //     h: deviceInfo.height,
        //     type: hmUI.data_type.SLEEP,
        //     line_color: 0xFFFFFF,
        //     line_width: 5
        //   })
        //   widget.clear()
        //   widget.addLine({
        //     data: lineDatas,
        //     count: lineDatas.length,
        //   })

    }

    function updateTracker(tracker) {

        const nowSeconds = state.time.utc / 1000
        const phase = getPhaseFromEpoch(nowSeconds, tracker.epoch.start, tracker.epoch.period, tracker.maxBins)
        tracker.set(phase.bin)
        if (tracker.flashed) {
            if(state.time.utc - tracker.lastFlash > FLICKER_FLASH_DURATIN)
                tracker.flashLastDigit()
            return
        }
        if (state.time.utc - tracker.lastFlash > Math.max(FLICKER_FLASH_DURATIN * 2, FLICKER_MAX_DURATION * (1.0 - phase.progress))) {
            tracker.lastFlash = state.time.utc
            tracker.flashLastDigit()
        }
    }

    function tick() {
    
        trackers.forEach(t => updateTracker(t))
    }

    function entrypoint() {
        build()
        tick()
		state.timerId = timer.createTimer(0, 20, () => {
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
            state.timerId && timer.stopTimer(state.timerId)
        }
    })
})()