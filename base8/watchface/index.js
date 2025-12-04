
(() => {
    
    class Period {
        constructor(color, epoch, duration) {
            this.color = color
            this.epoch = epoch
            this.duration = duration
        }
     }

    const NEW_MOON = 1763621220000
    const WINTER_SOLSTICE = 1734762060000
    const VERNAL_EQUINOX = 1742461440000
    const MID_NIGHT = 1764795600000
    const BIRTHDAY_ECLIPSE = 1736031937000

    const SYNODIC_MONTH = 2551443800
    const TROPICAL_YEAR = 31556925445
    const SIDEREAL_DAY = 86164090
    const DAY = 86400000
    const YEAR = 31557600000

    const COLOR_FG = 0xFFFFFF
    const START_X = 14
    const START_Y = 73
    let CELL_SIZE = 40
	const DIGIT_WIDTH = 16
    const DIGITS = 8
 	let timerId = null
    let binary = null
    let time = null
    let digits = []
    let screenWidth = 0
    let paused = false
    let period = 0
    let vibrate = null
    let maxBins = 0
    let radix = 2
    let mode = 0
    let percentText = null

    const MODES = 2

    let periods = [
        new Period(0xFFFFFF ,MID_NIGHT, DAY),
        new Period(0x8CE4FF, NEW_MOON, SYNODIC_MONTH),
        new Period(0xFFC300, VERNAL_EQUINOX, TROPICAL_YEAR),
        new Period(0x4DFFBE, WINTER_SOLSTICE, SIDEREAL_DAY),
        new Period(0xAA60C8, BIRTHDAY_ECLIPSE, YEAR),
     ]

     let prettyPeriods = new Set([
        512,
        4096,
        32768,
        262144,
        2097152,
        16777216,
        2097152,
        2097152 * 2,
        2097152 * 3,
        2097152 * 4,
        2097152 * 5,
        2097152 * 6,
        2097152 * 7]
    )

    let flags = [
        0b1000,
        0b1100,
        0b0100,
        0b0101,
        0b0001,
        0b0011,
        0b0010,
        0b1010,
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

    function handleClick() {

        period++
        if(period >= periods.length) {
            period = 0
        }
        digits.forEach(d => {
            d.setProperty(hmUI.prop.MORE, {
                color: periods[period].color,
            })
        })
    }

    function addDigit(x,y, size, thickness) {
        let index = digits.length
        const a = drawRect(x, y, thickness, size, COLOR_FG)
        const b = drawRect(x, y, size, thickness, COLOR_FG)
		const c = drawRect(x, y + size - thickness, size, thickness, COLOR_FG)
        const d = drawRect(x + size - thickness, y, thickness, size, COLOR_FG)
        digits.push(a)
        digits.push(b)
        digits.push(c)
        digits.push(d)

        return index / 4
    }

    function build() {
        maxBins = Math.pow(8, DIGITS)
        const deviceInfo = hmSetting.getDeviceInfo()
        vibrate = hmSensor.createSensor(hmSensor.id.VIBRATE)
        screenWidth = deviceInfo.width
        screenHeight = deviceInfo.height
        CELL_SIZE = (screenWidth / 2) - (DIGIT_WIDTH) - 6
        time = hmSensor.createSensor(hmSensor.id.TIME)

        percentText = hmUI.createWidget(hmUI.widget.TEXT, {
			x: screenWidth / 2 - 25,
            y: 425,
            w: 50,
            h: 50,
			color: 0xffffff,
			text_size: 24,
			align_h: hmUI.align.CENTER_H,
			align_v: hmUI.align.CENTER_V,
			text_style: hmUI.text_style.NONE,
			text: "0%" 
		})

		binary = hmUI.createWidget(hmUI.widget.TEXT, {
			x: 0,
			y: 25,
			w: screenWidth,
			h: 50,
			color: 0xffffff,
			text_size: 11,
			align_h: hmUI.align.CENTER_H,
			align_v: hmUI.align.CENTER_V,
			text_style: hmUI.text_style.NONE,
			text: time.utc 
		})


        binary.addEventListener(hmUI.event.CLICK_DOWN, (info) => {
        
            if (radix >= 16) {
                radix = 2
            }
            else {
                radix++
            }
        })

        let y = START_Y

        for (let i = 0; i < DIGITS / 2; i++) {
           
            addDigit(START_X + CELL_SIZE + DIGIT_WIDTH, y, (CELL_SIZE), DIGIT_WIDTH)
            addDigit(START_X, y, (CELL_SIZE), DIGIT_WIDTH)
            y += (CELL_SIZE + DIGIT_WIDTH)
        }

        digits.forEach((d,i) => {
            let index = i
            d.addEventListener(hmUI.event.CLICK_DOWN, (info) => {
      
                if(index < DIGITS * 2) {
                    handleClick()
                }
                else {
                    mode++
                    if(mode >= MODES) mode = 0
                    applyMode()
                }
        })})

    }

    function applyMode() {
        binary.setProperty(hmUI.prop.VISIBLE, mode == 0)
        percentText.setProperty(hmUI.prop.VISIBLE, mode == 0)
    }

    function setDigit(index,digit) {
        for (let i = 0; i < 4; i++) {
            digits[index * 4 + i].setProperty(hmUI.prop.VISIBLE, (flags[digit] & (1 << i)) == 0)
        }
    }

    function setTime(value) {
        binary.setProperty(hmUI.prop.TEXT, value.toString(radix))
        for (let i = DIGITS - 1; i >= 0; i--) {
            setDigit(i, value >> i * 3 & 0x7)
        }
        let normalized = value / maxBins
        percentText.setProperty(hmUI.prop.TEXT, Math.round(normalized * 100).toString() + "%")
    }

     function warn() {
       
        vibrate.stop()
        vibrate.scene = 23
        vibrate.start()

    }

    function notify() {
       
        vibrate.stop()
        vibrate.scene = 25
        vibrate.start()

    }

    function tick() {

        if (paused) return

        let p = periods[period]
        let ellapsed = (time.utc - p.epoch) % p.duration
        let mapped = Math.floor((ellapsed * maxBins) / p.duration)
        setTime(mapped)
        if (prettyPeriods.has(mapped - 8)) {
            warn()
        }
        else if (prettyPeriods.has(mapped)) {
            notify()
        }
    }

    function entrypoint() {
        build()
        tick()
		timerId = timer.createTimer(0, 64, () => {
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