var request = require("request-promise");

//endpoint for the wunderground api that deals with conditions and lat,long parameters
const WEATHER_ENDPOINT = "http://api.wunderground.com/api/" + process.env.WEATHER_API_KEY + "/conditions/q/"
const FORCAST_ENDPOINT = "http://api.wunderground.com/api/" + process.env.WEATHER_API_KEY + "/forecast/q/"
//returns the current temperature at the give lat and long
function getTemperatureData(latitude, longitude) {
  return request(WEATHER_ENDPOINT + latitude +","+longitude+".json").then(
    response => {
      let data = JSON.parse(response);
      if (data && data.current_observation){
        return data.current_observation.feelslike_string;
      }
      return "FAIL";
    }
  ).catch(error => console.log(error))
}
//returns recommendations for weather info
function getForecastRecommendations(latitude, longitude) {
  return request(FORCAST_ENDPOINT+ latitude +","+longitude+".json").then(
    response => {
      let data = JSON.parse(response);
      if (data && data.forecast && data.forecast.simpleforecast &&data.forecast.simpleforecast.forecastday){
        let forecast = data.forecast.simpleforecast.forecastday[0];
        let precipitation = forecast.qpf_allday.in > 0;
        let cold = forecast.low.fahrenheit < 40;
        let hot = forecast.high.fahrenheit > 80;
        let snow = forecast.snow_allday.in > 0;
        let wind = forecast.avewind.mph > 17;
        let humid = forecast.avehumid > 100;
        let conditions = forecast.conditions;
        let response = createRecommendationText(hot,cold,precipitation,snow,wind,humid,conditions);
        return response;
      }
      return "FAIL";
    }
  ).catch(error => console.log(error))
}

//create text response for recommendations
function createRecommendationText(hot, cold, rain, snow, wind, humid, conditions){
  let tempText = "mild" ;
  if (hot) {
    tempText="hot";
  }
  if (cold) {
    tempText="cold";
  }

  let overView = "Today is going to be " + tempText +" and have " + conditions.toLowerCase() + ' conditions. '

  let events = [];
  if (snow) {
    events.push("snow");
  }
  if (rain) {
    events.push("rain");
  }
  if (wind) {
    events.push("be windy");
  }
  if (humid) {
    events.push("be humid");
  }
  let eventsText = ""
  if(events.length==0){
    eventsText = "be nice outside"
  }
  else if (events.length<2){
    eventsText = events[0];
  } else if (events.length ==2){
    eventsText = events[0] + " and " +events[1];
  } else {
    for (let i = 0; i < events.length - 1; i++) {
      eventsText += events[i]+", ";
    }
    eventsText += "and " +events[events.length-1];
  }

  let weatherEvents = "Most likely it is going to " + eventsText +". ";

  let clothing = "";
  if (hot && rain){
    clothing = "shorts and bring an umbrella";
  } else if (hot){
    clothing ="shorts";
  } else if (!cold && !hot && wind){
    clothing = "a wind breaker";
  } else if(snow || cold){
    clothing = "a winter jacket"
  } else if (rain){
    clothing = "a rain jacket"
  } else {
    clothing = "anything you want"
  }

  let clothingRecommendation = "I would recommend wearing " + clothing +". ";
  let recommendations = overView;
  if (events.length >0) {
    recommendations += weatherEvents;
  }
  recommendations += clothingRecommendation;
  return recommendations;
}

module.exports = {getTemperatureData: getTemperatureData, getForecastRecommendations: getForecastRecommendations, createRecommendationText: createRecommendationText}
