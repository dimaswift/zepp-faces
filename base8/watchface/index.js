(() => {

    class Period {
        constructor(color, seconds) {
            this.color = color;
            this.seconds = seconds;
        }
     }
    const COLOR_FG = 0xFFFFFF
    const START_X = 14
    const START_Y = 64
    let CELL_SIZE = 40
	const DIGIT_WIDTH = 16
    const DIGITS = 8

 	let timerId = null
    
    let test = null
    let time = null
    let digits = []
    let screenWidth = 0
    let screenHeight = 0
    let clock = 0
    
    let period = 0

    let periods = [
        new Period(0x42f5ec, 100),
        new Period(0xFFFFFF, 1000)
     ]

    

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

    function renderTime() {
		
        const deviceInfo = hmSetting.getDeviceInfo()

        screenWidth = deviceInfo.width
        screenHeight = deviceInfo.height
        CELL_SIZE = (screenWidth / 2) - (DIGIT_WIDTH) - 6
        time = hmSensor.createSensor(hmSensor.id.TIME)

		test =	hmUI.createWidget(hmUI.widget.TEXT, {
			x: 0,
			y: screenHeight - 70,
			w: screenWidth,
			h: 50,
			color: 0xffffff,
			text_size: 16,
			align_h: hmUI.align.CENTER_H,
			align_v: hmUI.align.CENTER_V,
			text_style: hmUI.text_style.NONE,
			text: time.utc 
		});

        let y = START_Y

        for (let i = 0; i < DIGITS / 2; i++) {
            addDigit(START_X, y, (CELL_SIZE), DIGIT_WIDTH)
            addDigit(START_X + CELL_SIZE + DIGIT_WIDTH, y, (CELL_SIZE), DIGIT_WIDTH)
            y += (CELL_SIZE + DIGIT_WIDTH)
        }

        digits.forEach(d => {
            d.addEventListener(hmUI.event.CLICK_DOWN, (info) => {
            handleClick()
        })
        })
    }

    function setDigit(index,digit) {
        for (let i = 0; i < 4; i++) {
            digits[index * 4 + i].setProperty('alpha', (flags[digit] & (1 << i)) !== 0 ? 0 : 255)
        }
    }

    function entrypoint() {
        renderTime();
		timerId = timer.createTimer(0, 5, () => {
            clock++
            test.setProperty(
                hmUI.prop.TEXT,
                (time.utc - 694566337000).toString(8), 
            )
            let fraction = periods[period].seconds
            for (let i = 0; i < DIGITS; i++) {
                setDigit(i, (time.utc) >> i * 3 & 0x7)
            }
        });
    }

    var __$$app$$__ = __$$hmAppManager$$__.currentApp;
    var __$$module$$__ = __$$app$$__.current;
    __$$module$$__.module = DeviceRuntimeCore.WatchFace({
        onInit() {
            entrypoint();
        },
		onDestroy() {
            if (timerId) {
                timer.stopTimer(timerId);
            }
        }
    });
})();