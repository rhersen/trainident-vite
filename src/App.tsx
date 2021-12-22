import _ from "lodash"
import React, { useEffect, useState } from "react"
import { addDays, endOfDay, formatISO } from "date-fns"
import "./App.css"
import TrainAnnouncement from "./TrainAnnouncement"

let eventSource: EventSource | null = null

export default function App() {
  const [announcements, setAnnouncements] = useState<TrainAnnouncement[]>([])
  const [locations, setLocations] = useState<{ [key: string]: string }>({})
  const [train, setTrain] = useState("")

  useEffect(() => {
    async function fetchLocations() {
      const response = await fetch("/.netlify/functions/locations")
      setLocations(await response.json())
    }

    function cleanup() {
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    }

    fetchLocations()

    return cleanup
  }, [])

  function getCurrent(trainId: string) {
    return async () => {
      const until = formatISO(endOfDay(addDays(new Date(), 1))).slice(0, 19)

      const response = await fetch(
        `/.netlify/functions/announcements?trainId=${trainId}&until=${until}`
      )
      const json = await response.json()
      const announcements = json.TrainAnnouncement

      if (json.INFO) {
        if (eventSource) eventSource.close()
        eventSource = new EventSource(json.INFO.SSEURL)
        eventSource.onmessage = (event) => {
          const parsed = JSON.parse(event.data)
          setAnnouncements(
            announcements.concat(parsed.RESPONSE.RESULT[0].TrainAnnouncement)
          )
        }
      }

      setAnnouncements(announcements)
      setTrain("")
    }
  }

  const sorted: TrainAnnouncement[] = _.orderBy(
    announcements,
    "AdvertisedTimeAtLocation"
  )

  const rowKeys: string[] = _.uniq(_.map(sorted, activityAndLocation))
  const colKeys: string[] = _.uniq(_.map(sorted, date))
  const cells: {
    [key: string]: TrainAnnouncement
  } = _.keyBy(
    sorted,
    (a: TrainAnnouncement): string => activityAndLocation(a) + date(a)
  )

  return (
    <div>
      <input
        type="text"
        value={train}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          setTrain(event.target.value)
        }}
        onKeyPress={(event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") return getCurrent(train)()
        }}
      />
      <span onClick={getCurrent(train)}>submit</span>
      <table>
        <tbody>
          <tr>
            <th>location</th>
            {_.map(colKeys, (colKey) => {
              return (
                <React.Fragment key={colKey}>
                  <th />
                  <th>{colKey.slice(8)}</th>
                </React.Fragment>
              )
            })}
          </tr>
          {_.map(rowKeys, (rowKey) => {
            const [activity, signature] = rowKey.split(":")
            return (
              <tr key={rowKey}>
                <td>
                  {activity === "Avgang" ? "" : activity}{" "}
                  {locations[signature] ? locations[signature] : signature}
                </td>
                {_.map(colKeys, (colKey) => {
                  const cell = cells[rowKey + colKey]
                  if (!cell)
                    return (
                      <React.Fragment key={colKey}>
                        <td />
                        <td />
                      </React.Fragment>
                    )
                  const t = cell.TimeAtLocationWithSeconds
                  const a = cell.AdvertisedTimeAtLocation
                  return (
                    <React.Fragment key={colKey}>
                      <td>{t ? t.slice(11, 19) : "-"}</td>
                      <td>{a ? a.slice(11, 16) : "-"}</td>
                    </React.Fragment>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function activityAndLocation(a: TrainAnnouncement): string {
  return `${a.ActivityType}:${a.LocationSignature}`
}

function date(a: TrainAnnouncement): string {
  return a.AdvertisedTimeAtLocation.slice(0, 10)
}
