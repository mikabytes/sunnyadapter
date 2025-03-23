# Sunny Adapter

A small service that creates a simple (limited, unofficial) API for SunnyPortal.com.

It uses a chromium browser in the background to login, press buttons, fill in forms, etc. For now it has a single feature, setting the _Time window control for charging the battery-storage system_

# How to use

You can run this as a NPM package or as Docker.

```
npm install -g sunnyadapter
PORT=3000 USER=myuser PASSWORD=mypassword sunnyadapter
```

```
docker run -it ghcr.io/mikabytes/sunnyadapter -e USER=myuser -e PASSWORD=mypassword -p 3000:3000
```

Then, a service will run on the chosen port.

# API

As of now there is a single endpoint:

```
PUT /plants/:plant/battery/time-window

[{"start": STARTSTR, "stop": STOPSTR, "power": WATTAGE}, {...}, {...}]
```

Where `:plant` should be replaced with the value of the first column in this table [https://sunnyportal.com/Plants](https://sunnyportal.com/Plants)

Where objects should be formatted as following:

| type       | description                                                                                 | examples                               |
| ---------- | ------------------------------------------------------------------------------------------- | -------------------------------------- |
| `STARTSTR` | 24-hour formatted time                                                                      | `00:00` `05:30` `5:30` `23:30` `12:34` |
| `STOPSTR`  | 24-hour formatted time OR an offset starting with plus (`+`) sign ending with unit (h or m) | `00:00` `23:30` `+3h` `+15m` `+127m`   |
| `WATTAGE`  | An integer number (no decimals allowed), can be formatted as string if needed               |

**Note 1:** SunnyPortal has a known bug where `00:00` as start or stop time leads to a bug. Therefor, the adapter will automatically change `00:00` into `00:15`

**Note 2:** This API allows any minute in the range 0 to 59, however SunnyPortal requires full quarters, so your input will be changed into the earlier full quarter time. Example 0 becomes 0, 4 becomes 0, 29 becomes 15.

**Note 3:** Offsets are relative to the start time and periods that spans several days or hours are handled appropriately, see table for examples:

| start   | stop   | actual stop time |
| ------- | ------ | ---------------- |
| `00:00` | `+2h`  | `02:00`          |
| `00:00` | `+90m` | `01:30`          |
| `23:30` | `+3h`  | `02:30`          |

## Example curl usage

**Setting a schedule with three periods**

```
curl -X PUT http://localhost:3000/plants/granstugan/battery/time-window -H 'Content-Type: application/json' -d '[{ "start": "11:00", "stop": "12:00", "power": 20 }, { "start": "13:00", "stop": "+5h", "power": "21"}, {"start":"19:00", "stop":"00:00", "power": 22 }]'
```

**Removing a schedule**

```
curl -X PUT http://localhost:3000/plants/granstugan/battery/time-window -H 'Content-Type: application/json' -d '[]'
```
