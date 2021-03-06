var request = require("request");
var WeatherDataUtils = require("./DataUtils/WeatherDataUtils");
var NewsDataUtils = require("./DataUtils/NewsDataUtils");
var DatabaseUtils = require("./StorageUtils/DatabaseUtils");
var SportsDataUtils = require("./DataUtils/SportsDataUtils");
var MapsDataUtils = require("./DataUtils/MapsDataUtils")
var EmailUtils = require("./Email/EmailUtils");
var RetreiveUrl = require("./Email/RetreiveUrl");
var Wit = require("./ai/wit");
var Tip = require("./Utils/tip");



//flags for multiple message conversations
let locationName = null;
let weatherRecommendations = false;
let originLat = null;
let originLong = null;
let estimateTime = false;
//access token for page - set in heroku for security
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
//endpoint to send response messages to
const FACEBOOK_ENDPOINT = "https://graph.facebook.com/v2.6/me/messages"

//receives a message and a sender id. Deteremines the correct response
function handleMessage(sender_psid, received_message) {
  let response = null;

  // Check if the message contains text
  if (received_message.text) {
    let greeting = firstEntity(received_message.nlp, 'greetings');
    // Create the payload for a basic text message
    if (received_message.text === "@help") {
      response = {
        "text": "I am a personal assistant chatbot. Learn how I can help you at: http://marvin-assistant.herokuapp.com/"
      }
    } else if (received_message.text === "@hi") {
      response = {
        "text": "Hi. I hope you are having a good day!"
      }
    } else if (received_message.text === "Email Setup") {
      response = {
        "text": received_message.text,
      }
    } else if (received_message.text === "@weather") {
      response = {
        "text": "Where are you so I can get weather data?",
        "quick_replies":[
          {"content_type":"location"}
        ]
      }
      weatherRecommendations = true;
      return sendMessage(sender_psid,response);
    } else if(received_message.text === "@temperature"){
      response = {
        "text": "Where are you so I can get the temperature?",
        "quick_replies":[
          {"content_type":"location"}
        ]
      }
    } else if (received_message.text === "@todo") {
      sendTodoButton(sender_psid);
    } else if (received_message.text === "@news") {
      sendNewsHeadlines(sender_psid);
    } else if (received_message.text === "@locations") {
      sendLocations(sender_psid);
    } else if (received_message.text.substring(0,11) === "@setupemail") {
      startOath(sender_psid, received_message.text.substring(12));
    } else if (received_message.text.substring(0,6) === "@email") {
      sendEmail(sender_psid, received_message.text.substring(7));
    } else if (received_message.text.substring(0,8) === "@addteam") {
      addTeam(sender_psid, received_message.text.substring(9));
    } else if (received_message.text === "@scores") {
      sendTeams(sender_psid);
    } else if (received_message.text === "@myteams") {
      sendMyTeams(sender_psid);
    } else if (received_message.text === "@estimatetime") {
      estimateTime = true
      response = {
        "text": `Where are you starting ?`,
        "quick_replies":[
          {"content_type":"location"}
        ]
      };
      return sendMessage(sender_psid, response);
    } else if (received_message.text.substring(0,9) === "@location") {
      locationName = received_message.text.substring(10);
      response = {
        "text": `What location would you like to store for "${locationName}" ?`,
        "quick_replies":[
          {"content_type":"location"}
        ]
      };
      return sendMessage(sender_psid, response);
    } else if (received_message.text === "@create") {
      //DatabaseUtils.createTeamTable();
    } else if (received_message.text === "@insert") {
      DatabaseUtils.insertTeam('test', 'nba', 'Celtics', 'bos');
    } else if (received_message.text === "@print") {
      DatabaseUtils.PrintTeams();
    } else if (received_message.text.substring(0,4) === "@wit") {
      Wit.runWit(received_message.text.substring(5));
    } else if (greeting && greeting.confidence > 0.8) {
      response = {
        "text": "Hello! My name is Marvin and I am good.",
      }
    } else {
      Wit.processWithAI(received_message.text).then(result => {
        resetValues();
        let response = null;
        switch(result.type){
          case Wit.MESSAGE_TYPE_ENUM.WEATHER:
            response = {
              "text": "Where are you so I can get weather recommendations?",
              "quick_replies":[
                {"content_type":"location"}
              ]
            }
            weatherRecommendations = true;
            break;
          case Wit.MESSAGE_TYPE_ENUM.TEMPERATURE:
            response = {
              "text": "Where are you so I can get the current temperature?",
              "quick_replies":[
                {"content_type":"location"}
              ]
            }
            break;
          case Wit.MESSAGE_TYPE_ENUM.TIP:
            response = {
              "text": Tip.createTipString(result.number),
            }
            break;
          case Wit.MESSAGE_TYPE_ENUM.NEWS:
            return sendNewsHeadlines(sender_psid);
          default:
            response = {
              text: "Sorry I do not know how to respond. "
            }
        }
        sendMessage(sender_psid, response)
      });
      return;
    }
  } else if (received_message.attachments) {

    // Gets the corrdintes of the message attachment
    let coordinates = received_message.attachments[0].payload.coordinates;
    if (!coordinates) {
      return;
    }
    if (locationName){
      DatabaseUtils.insertLocation(sender_psid, locationName, coordinates.long, coordinates.lat);
    } else if (weatherRecommendations) {
      WeatherDataUtils.getForecastRecommendations(coordinates.lat, coordinates.long).then(info => {
        if (!info || info == "FAIL"){
          response = {
            "text": "Sorry I could not find any weather data for that location.",
          }
        }
        else {
          response = {
            "text": info
          }
        }
        sendMessage(sender_psid, response);
      });
    } else if(estimateTime) {
      if (originLat != null && originLong!=null){
        //helper function for callback in maps api
        function parseDistance(err, distances) {
          if (!err){
            let result = (distances.rows[0].elements[0].duration.text);
            let response = {
              text: "The trip will take " + result
            }
            sendMessage(sender_psid, response)
          }
        };
        MapsDataUtils.getTimeFromOriginToDest(originLat,originLong, coordinates.lat, coordinates.long, 'walking', parseDistance);
      } else {
        originLat = coordinates.lat
        originLong = coordinates.long
        response = {
          "text": `What location would you like to go to?`,
          "quick_replies":[
            {"content_type":"location"}
          ]
        };
        return sendMessage(sender_psid, response);
      }
    }
    else {
      WeatherDataUtils.getTemperatureData(coordinates.lat, coordinates.long).then(
        tempString => {
          if (!tempString || tempString == "FAIL"){
            response = {
              "text": "Sorry I could find any weather data for that location.",
            }
          } else {
            response = {
              "text": "The current temperature is " + tempString,
            }
          }
          sendMessage(sender_psid, response);
        }
      );
    }
  }
  // Sends the response message
  //clears flag variables
  resetValues();
  sendMessage(sender_psid, response);
}

//clears state values
function resetValues(){
  locationName=null;
  weatherRecommendations = false;
  estimateTime = false;
  originLat = null;
  originLong = null;
}

//Handle postback for persistent menu
function handlePostback(sender_psid, received_message) {
  if(received_message.payload.includes(":")){
    let [action, league, name, city] = received_message.payload.split(":");
    switch(action){
      case "add":
      DatabaseUtils.insertTeam(sender_psid,league,name,city);
      sendMessage(sender_psid, {text: name + " added"});
      break;
      case "delete":
      DatabaseUtils.deleteTeam(sender_psid,league,name,city);
      sendMessage(sender_psid, {text: name + " removed"});
      break;
      case "score":
      sendScore(sender_psid, league, city);
      break;
    }
    return;
  }
  switch (received_message.payload) {
    case "NEWS":
      sendNewsHeadlines(sender_psid);
      break;
    case "LOCATIONS":
      sendLocations(sender_psid);
      break;
    case "WEATHER":
      response = {
        "text": "Where are you so I can get weather recommendations?",
        "quick_replies":[
          {"content_type":"location"}
        ]
      };
      weatherRecommendations = true;
      sendMessage(sender_psid, response);
      break;
    case "TEMPERATURE":
      response = {
        "text": "Where are you so I can get the current temperature?",
        "quick_replies":[
          {"content_type":"location"}
        ]
      };
      sendMessage(sender_psid, response);
      break;
    case "GOOGLE":
      response = {
        "attachment":{
          "type":"template",
          "payload":{
            "template_type":"button",
            "text": "Google!",
            "buttons":[
              {
                "type":"web_url",
                "url":"https://www.google.com",
                "title":"Google",
                "webview_height_ratio": "tall",
                "messenger_extensions": true,
                "fallback_url": "https://www.google.com"
              }
            ]
          }
        }
      };
      sendMessage(sender_psid, response);
      break;
    case "HELP":
      response = {
        "text": "I am a personal assistant chatbot. Learn how I can help you at: http://marvin-assistant.herokuapp.com/"
      };
      sendMessage(sender_psid, response);
      break;
    case "TRAVEL":
      estimateTime = true
      response = {
        "text": `Where are you starting?`,
        "quick_replies":[
          {"content_type":"location"}
        ]
      };
      sendMessage(sender_psid, response);
      break;
    case "TEAMS":
      console.log('teams');
      sendMyTeams(sender_psid);
      break;
    case "SCORES":
      sendTeams(sender_psid);
      break;
    case "Get Started":
      sendMessage(sender_psid, {
        text: "Hello, my name is Marvin and I am a personal assistant chatbot. Check out the menu of options or visit http://marvin-assistant.herokuapp.com/ to see all of the ways I can help you"
      })
    default:
      break;
  }
}

//sends headlines for the news
function sendNewsHeadlines(sender_psid){
  NewsDataUtils.getNewsHeadlines().then(headlines => {
    let tiles = headlines.map((headline) => {
      return {
        "title": headline.title,
        "image_url":headline.imageURL,
        "buttons":[
          {
            "type":"web_url",
            "url": headline.url,
            "title":"Read Article"
          }
        ]
      }
    });
    let response = {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"generic",
          "elements": tiles,
        }
      }
    };
    sendMessage(sender_psid, response);
  });
}

//repond with the names of stored locations
function sendLocations(sender_psid){
  DatabaseUtils.getLocations(sender_psid).then((locations) => {
    let locationString ="";
    for( let l of locations){
      locationString+= l +"\n";
    }
    let response = {
      "text": locationString,
    }
    sendMessage(sender_psid, response)
  });
}

//sends an email based on message
//message should be a 3 tuple of email, subject, Content
//delimiter = ","
function sendEmail(sender_psid, message){
  let parts = message.split(",");
  DatabaseUtils.getEmailToken(sender_psid).then( (token) => {
    let response;
    if(!token){
      response = {
        text: "Email not setup yet",
      }
      sendMessage(sender_psid, response);
      return;
    }
    EmailUtils.sendMail(token, parts[0], parts[1], parts[2]);
    response = {
      text: "Email sent to " + parts[0],
    }
    sendMessage(sender_psid, response);
  });
}

//sends a todo button link that will open a webapge
function sendTodoButton(sender_psid){
  response = {
    "attachment":{
      "type":"template",
      "payload":{
        "template_type":"button",
        "text": "TODO",
        "buttons":[
          {
            "type":"web_url",
            "url":"https://marvin-assistant.herokuapp.com/todo",
            "title":"TODO",
            "webview_height_ratio": "tall",
            "messenger_extensions": true,
            "fallback_url": "https://www.google.com"
          }
        ]
      }
    }
  };
  sendMessage(sender_psid, response);
}

//starts email oath process
function startOath(sender_psid, email){
  DatabaseUtils.insertEmail(sender_psid, email, null);
  RetreiveUrl.getAuthorizationUrl((err, url) => {
    let response = {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"button",
          "text": "Setup "+email,
          "buttons":[
            {
              "type":"web_url",
              "url": url,
              "title":"Authenticate",
            }
          ]
        }
      }
    };
    sendMessage(sender_psid, response);
  })
}

//adds team to a users set of teams
function addTeam(sender_psid, input){
  let [league, name] = input.split(" ");
  if(!name){
    return sendMessage(sender_psid, {text: "@addteam <league> <name>"});
  }
  SportsDataUtils.getTeams(league, (teams)=> {
    teams = teams.filter(team => {
      return team.name.toLowerCase().includes(name.toLowerCase())
    });
    let tiles = teams.map((team) => {
      return {
        "title": team.name,
        "buttons":[
          {
            "type": "postback",
            "title": "Add",
            "payload": "add:" + league+":"+team.name+":"+team.city
          }
        ]
      }
    });
    let response = {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"generic",
          "elements": tiles,
        }
      }
    };
    if (tiles.length === 0){
      response = {
        text: "No teams match the name you entered",
      }
    }
    if (tiles.length > 10){
      response = {
        text: "Too many teams. Enter a more specific name.",
      }
    }
    sendMessage(sender_psid, response);
  });
}

//send score of the game
function sendScore(sender_psid, league, city){
  SportsDataUtils.getLastGame(league, city, (string)=>{
    let response = {
      text: string,
    };
    sendMessage(sender_psid, response);
  })
}

//sends the teams a users have with option to get score
function sendTeams(sender_psid){
  DatabaseUtils.getTeams(sender_psid).then(teams =>{
    let tiles = teams.map((team) => {
      return {
        "title": team.name,
        "buttons":[
          {
            "type": "postback",
            "title": "Score",
            "payload": "score:" + team.league+":"+team.name+":"+team.city
          }
        ]
      }
    });
    let response = {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"generic",
          "elements": tiles,
        }
      }
    };
    sendMessage(sender_psid, response);
  });
}

//sends the teams a users have with option to remove
function sendMyTeams(sender_psid){
  DatabaseUtils.getTeams(sender_psid).then(teams =>{
    let tiles = teams.map((team) => {
      return {
        "title": team.name,
        "buttons":[
          {
            "type": "postback",
            "title": "Remove",
            "payload": "delete:" + team.league+":"+team.name+":"+team.city
          }
        ]
      }
    });
    tiles = tiles.concat([
      {
        "title": "New Team",
        "buttons":[
          {
            "type": "postback",
            "title": "Add",
            "payload": "ADD TEAM"
          }
        ]
      }
    ]);
    let response = {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"generic",
          "elements": tiles,
        }
      }
    };
    sendMessage(sender_psid, response);
  });
}

//sends a message back to the sender id over facebook messenger
function sendMessage(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response,

  }
  // Send the HTTP request to the Messenger Platform
  request({
    "uri": FACEBOOK_ENDPOINT,
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}

//NLP helper function
function firstEntity(nlp, name) {
  return nlp && nlp.entities && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}



module.exports = {handleMessage: handleMessage, handlePostback: handlePostback}
