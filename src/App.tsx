import _ from "lodash"
import React from "react"
import { addDays, endOfDay, formatISO } from "date-fns"
import "./App.css"
import TrainAnnouncement from "./TrainAnnouncement"

let eventSource: EventSource | null = null

type AppState = {
  announcements: TrainAnnouncement[]
  locations: { [key: string]: string }
  clicked: string
}

export default class App extends React.Component<{}, AppState> {
  state: AppState = { announcements: [], locations: {}, clicked: "" }

  async componentDidMount() {
    const response = await fetch("/.netlify/functions/locations")
    const locations = await response.json()
    this.setState({ locations })
  }

  componentWillUnmount() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  getCurrent(trainId: string) {
    return async (ev: any) => {
      if (ev.key && ev.key !== "Enter") return

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
          this.setState(({ announcements }) => ({
            announcements: announcements.concat(
              parsed.RESPONSE.RESULT[0].TrainAnnouncement
            ),
          }))
        }
      }

      this.setState({
        announcements,
        clicked: "",
      })
    }
  }

  render() {
    const sorted: TrainAnnouncement[] = _.orderBy(
      this.state.announcements,
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
          value={this.state.clicked}
          onChange={(event: any) => {
            this.setState({ clicked: event.target.value })
          }}
          onKeyPress={this.getCurrent(this.state.clicked)}
        />
        <span onClick={this.getCurrent(this.state.clicked)}>submit</span>
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
              const strings = rowKey.split(":")
              return (
                <tr key={rowKey}>
                  <td>
                    {strings[0] === "Avgang" ? "" : strings[0]}{" "}
                    {this.state.locations[strings[1]]
                      ? this.state.locations[strings[1]]
                      : strings[1]}
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
}

function activityAndLocation(a: TrainAnnouncement): string {
  return `${a.ActivityType}:${a.LocationSignature}`
}

function date(a: TrainAnnouncement): string {
  return a.AdvertisedTimeAtLocation.slice(0, 10)
}
