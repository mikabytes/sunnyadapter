import express from "express"
import path from "path"
import fs from "fs/promises"
import bodyParser from "body-parser"
import * as battery from "./battery.js"

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

app.put(`/plants/:plant/battery/time-window`, async (req, res) => {
  try {
    await battery.setTimeWindow(req.params.plant, req.body)
  } catch (e) {
    res.status(400)
    res.json({ success: false, message: e.message })
    console.error(e)
    return
  }
  res.json({ success: true })
})

app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`)
})
