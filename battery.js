import puppeteer from "puppeteer"

export async function setTimeWindow(plant, schedule) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  let page
  try {
    page = await browser.newPage()

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
    })

    await page.goto(`https://sunnyportal.com`)

    await page.waitForSelector(`#onetrust-reject-all-handler`)
    await page.click(`#onetrust-reject-all-handler`)
    await delay(3000) // stupid animation thing

    const firstLoginButton = `#ctl00_ContentPlaceHolder1_Logincontrol1_SmaIdLoginButton`
    await page.waitForSelector(firstLoginButton)
    await page.click(firstLoginButton)
    await page.waitForSelector(`#username`)

    const usernameField = `#username`
    await page.waitForSelector(usernameField)
    await page.click(usernameField)
    await page.keyboard.type(process.env.USER)

    const passwordField = `#password`
    await page.click(passwordField)
    await page.keyboard.type(process.env.PASSWORD)

    await delay(500)
    await page.evaluate(() => {
      const form = document.querySelector('form[name="loginForm"]')
      const loginButton = form?.querySelector('button[name="login"]')
      loginButton?.click() // triggers full native JS flow including `onsubmit`
    })
    await page.waitForSelector(`.user`)
    await page.goto(`https://sunnyportal.com/Plants`)

    const plants = await page.evaluate(async () => {
      function get() {
        const pvList = [...document.querySelectorAll("div:has(> h2)")].filter(
          (div) =>
            div
              .querySelector("h2")
              .textContent.toLowerCase()
              .includes(`pv system list`)
        )[0]
        const pvs = [...pvList.querySelectorAll(`a`)].filter((a) =>
          a.href.includes(`RedirectToPlant`)
        )

        const ret = {}
        for (const a of pvs) {
          ret[a.textContent.toLowerCase()] = a.href
        }
        return ret
      }

      let ret
      do {
        await new Promise((res) => setTimeout(res, 1000))
        ret = get()
      } while (Object.keys(ret).length === 0)

      return ret
    })

    if (!plants || !plants[plant.toLowerCase()]) {
      throw new Error(`Could not find plant '${plant}'`)
    }

    const plantUrl = plants[plant.toLowerCase()]
    console.log(`Going to ${plantUrl}`)
    await page.goto(plantUrl)
    await delay(2000)

    await page.goto(`https://sunnyportal.com/Templates/PlantProperties.aspx`)
    await page.waitForSelector(
      `#ctl00_ContentPlaceHolder1_LinkButtonParameter_TabFormulaConfiguration`
    )
    await page.click(
      `#ctl00_ContentPlaceHolder1_LinkButtonParameter_TabFormulaConfiguration`
    )
    await page.waitForSelector(
      `#ctl00_ContentPlaceHolder1_EditConfigurationButton`
    )
    await page.click(`#ctl00_ContentPlaceHolder1_EditConfigurationButton`)
    await page.waitForSelector(
      `#ctl00_ContentPlaceHolder1_trHomanBatteryCharge`
    )
    await delay(3000)

    console.log(`Attempting to delete existing schedules`)
    await page.evaluate(async () => {
      const els = [
        ...document.querySelectorAll(`#batChargeInputLinesRow > table img`),
      ]
      for (const el of els) {
        el.click()
        await new Promise((res) => setTimeout(res, 300))
      }
    })

    for (const schema of schedule) {
      console.log(`Adding new schema: ${JSON.stringify(schema)}`)
      await addSchema(page, schema)
    }

    console.log(`Saving it....`)
    await delay(1000)

    await page.click(`#ctl00_ContentPlaceHolder1_SaveButton`)
    await delay(5000)

    console.log(`Checking if there was an error`)
    const error = await page.evaluate(async () => {
      const el = document.querySelector(`#ctl00_ContentPlaceHolder1_ErrorLabel`)
      if (el) {
        return el.textContent
      }
      return false
    })

    if (error) {
      throw new Error(error)
    }

    console.log(`We're done!!!`)
  } catch (e) {
    if (!page.isClosed()) {
      await page.screenshot({ path: "page.png", fullPage: true })
    }
    throw e
  } finally {
    try {
      if (!page.isClosed()) {
        await page.close()
      }
    } catch (err) {
      console.warn("Page already closed or failed to close:", err.message)
    }

    try {
      await browser.close()
    } catch (err) {
      console.warn("Browser already closed or failed to close:", err.message)
    }
  }
}

function parse24HourTime(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number)
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Can't parse '${timeStr}'`)
  }
  return { hours, minutes }
}

function formatTime({ hours, minutes }) {
  // Sunnyportal cannot handle true midnight, buggy buggy
  if (hours === 0 && minutes === 0) {
    minutes = 15
  }

  let period = hours >= 12 ? "PM" : "AM"
  let formattedHours = hours % 12

  // Adjust midnight and noon
  formattedHours = formattedHours ? formattedHours : 12

  // Pad minutes with a leading zero if necessary
  let formattedMinutes = minutes.toString().padStart(2, "0")

  return `${formattedHours}:${formattedMinutes} ${period}`
}

function getPreviousQuarter(minutes) {
  return Math.floor(minutes / 15) * 15
}

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function addSchema(page, args) {
  console.log(`Adding schema: ${JSON.stringify(args)}`)
  if (!args.start) {
    throw new Error(`You must specify the 'start' parameter`)
  }

  if (!args.stop) {
    throw new Error(`You must specify the 'stop' parameter`)
  }

  if (`${args.power}` != `${+args.power}`) {
    throw new Error(`You must specify the 'power' parameter`)
  }

  args.start = args.start.toLowerCase()
  args.stop = args.stop.toLowerCase()
  args.power = +args.power

  const hours24 = /^([01]?\d|2[0-3]):[0-5]\d$/

  if (!hours24.test(args.start)) {
    throw new Error(`'start' parameter must be in 24-hour format`)
  }

  const start = parse24HourTime(args.start)
  const power = +args.power
  let stop

  if (args.stop.startsWith(`+`)) {
    const match = args.stop.match(/^\+(\d+)([mh])$/)
    if (!match) {
      throw new Error(`Malformed 'stop' variable offset expression`)
    }

    const offset = parseInt(match[1], 10)
    const unit = match[2]

    stop = { ...start }

    if (unit === `h`) {
      stop.hours += offset
    } else if (unit === `m`) {
      stop.minutes += offset
    }

    stop.hours = (stop.hours + Math.floor(stop.minutes / 60)) % 24
    stop.minutes = stop.minutes % 60
  } else {
    if (!hours24.test(args.stop)) {
      throw new Error(
        `'stop' parameter must be in 24-hour format or valid offset`
      )
    }
    stop = parse24HourTime(args.stop)
  }

  start.minutes = getPreviousQuarter(start.minutes)
  stop.minutes = getPreviousQuarter(stop.minutes)

  await page.click(`#addBatChargeButton`)
  await delay(1000)

  await page.evaluate(
    async (start, stop, power) => {
      function type(el, newValue) {
        // Focus and click
        el.focus()
        el.dispatchEvent(new Event("focus", { bubbles: true }))
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }))

        // Select all and "simulate" keypress deletion
        el.setSelectionRange(0, el.value.length)

        // Fire keydown, keypress, input, keyup for backspace
        el.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Backspace", bubbles: true })
        )
        el.value = "" // Clear manually
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(
          new KeyboardEvent("keyup", { key: "Backspace", bubbles: true })
        )

        // Set new value
        el.value = newValue
        el.dispatchEvent(new Event("input", { bubbles: true }))

        // Fire "keypress" events as if typing
        for (const char of newValue) {
          el.dispatchEvent(
            new KeyboardEvent("keydown", { key: char, bubbles: true })
          )
          el.dispatchEvent(
            new KeyboardEvent("keypress", { key: char, bubbles: true })
          )
          el.dispatchEvent(
            new KeyboardEvent("keyup", { key: char, bubbles: true })
          )
        }

        // Blur (to trigger 'change')
        el.blur()
        el.dispatchEvent(new Event("blur", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
      }

      const [from, to, pwr] = [
        ...document.querySelectorAll(`#batChargeInputLinesRow > table`),
      ]
        .pop()
        .querySelectorAll(`input`)

      console.log(`Typing '${start}' into ${from.id}`)
      type(from, start)

      console.log(`Typing '${stop}' into ${to.id}`)
      type(to, stop)

      console.log(`Typing '${power}' into ${pwr.id}`)
      type(pwr, power)
    },
    formatTime(start),
    formatTime(stop),
    `${power}`
  )

  await delay(500)
}
