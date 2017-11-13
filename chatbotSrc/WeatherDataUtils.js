var request = require("request");
const WEATHER_ENDPOINT = "http://api.wunderground.com/api/" + process.env.WEATHER_API_KEY + "/conditions/q/"
function getWeatherData(latitude, longitude) {

  let response;

  // Send the HTTP request to the Messenger Platform
  request(WEATHER_ENDPOINT + latitude +","+longitude+".json", (err, res, body) => {
    if (!err) {
      console.log("A");
      console.log(body["current_observation"]);
      console.log("B")
      //console.log(res);
    } else {
      console.error("Error getting data");
    }
  });
}

module.exports = {getWeatherData: getWeatherData}