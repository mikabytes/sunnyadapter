import express from "express"
import path from "path"
import fs from "fs/promises"
import bodyParser from "body-parser"
import * as battery from "./battery.js"
import IsSame from "./IsSame.js"

const app = express()
const port = process.env.PORT || 3000

if (!process.env.USER) {
  throw new Error(`No USER env variable`)
}

if (!process.env.PASSWORD) {
  throw new Error(`No PASSWORD env variable`)
}

if (!process.env.AUTH) {
  throw new Error(`No AUTH env variable`)
}

app.use((req, res, next) => {
  const authHeader = req.headers["authorization"]

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1]
    if (token === process.env.AUTH) {
      next()
      return
    }
  }
  return res
    .status(401)
    .json({ message: "Missing or invalid authorization header" })
})

app.use(bodyParser.json())

let isSame = IsSame()
let lastPlant
app.put(`/plants/:plant/battery/time-window`, async (req, res) => {
  if (isSame(req.body) && req.params.plant === lastPlant) {
    console.log(
      `Skipping duplicate call ${req.url} with ${JSON.stringify(req.body)}`
    )
    res.json({ success: true, message: "Duplicate args, no action performed" })
    return
  } else {
    lastPlant = req.params.plant
  }

  let isError, errorText
  let attempts = 0

  while (attempts < 3) {
    isError = false
    errorText = ``

    try {
      await battery.setTimeWindow(req.params.plant, req.body)
      isError = false
      break
    } catch (e) {
      isError = true
      attempts++
      errorText = `${errorText}${e.message}\n\n`
      console.error(`${new Date().toISOString()}`, e)
    }
  }

  if (isError) {
    res.status(400)
    res.json({ success: false, message: errorText })
  } else {
    res.json({ success: true })
  }
})

app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`)
})
