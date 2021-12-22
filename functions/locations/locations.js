const fetch = require("node-fetch")
exports.handler = async () => {
  try {
    const response = await fetch(
      "https://trafikverket-locations.netlify.app/short.json"
    )
    if (!response.ok)
      return {
        statusCode: response.status,
        body: JSON.stringify({ msg: response.statusText }),
      }

    const data = await response.json()

    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (err) {
    console.log(err) // output to netlify function log
    return { statusCode: 500, body: JSON.stringify({ msg: err.message }) }
  }
}
