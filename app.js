const http = require('http');
const express = require('express');
const app = express();
const fs = require('fs')
const { Server } = require("socket.io");

var options = {
};

const server = http.createServer(options, app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8
});

const userMap = new Map();

let buzzInfo = [];
let idkList = [];
let userList = [];

const MAX_CHARGES = 3;
let isChargeModeEnabled = false;
let userChargeData = new Object();

let userInfo = new Object();//Each user has properties, and is stored as a property of userInfo
let anyObjections = false;
const teamsList = ["Players", "Chasers"]
const teamsScore = [0, 0];
let currentTeamNumber = 0;
let sockets = []

async function resetApp() {
  console.log("resetting app");
  io.emit("resetApp");
  Object.keys(options).forEach(x => delete options[x]);
  userMap.clear();
  buzzInfo.splice(0, buzzInfo.length);
  idkList.splice(0, idkList.length);
  userList.splice(0, userList.length);
  Object.keys(userMap).forEach(x => delete userMap[x]);
  Object.keys(userInfo).forEach(x => delete userInfo[x]);
  Object.keys(userChargeData).forEach(x => delete userChargeData[x]);
  anyObjections = false;
  isChargeModeEnabled = false;
  teamsList.splice(0, teamsList.length, "Players", "Chasers");
  teamsScore.splice(0, teamsScore.length, 0, 0);
  currentTeamNumber = 0;

  const oldSockets = sockets;
  sockets = [];

  await new Promise(ok => setTimeout(ok, 1000));
  oldSockets.forEach(x => x.disconnect(true));
  oldSockets.splice(0, oldSockets.length);
}

// finds a user with zero charges left on current team, if they exist
function getUserOnZeroCharges(teamName) {
  const zeroChargeUserOnCurrentTeam = Object.entries(userChargeData).find(([_, chargeData]) => chargeData.teamName == teamName && chargeData.charges == 0)?.[0];
  return zeroChargeUserOnCurrentTeam ? getUserId(zeroChargeUserOnCurrentTeam) : "";
}

function getUserId(userName) {
  return userName.replaceAll(" ", "_");
}

io.on("connection", (socket) => {
  console.log("a user connected");
  sockets.push(socket);

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  // initial info on connection
  socket.emit("gameStateToClient", teamsList[currentTeamNumber], teamsScore[currentTeamNumber], isChargeModeEnabled, userChargeData);
  socket.emit("getChargeModeState", isChargeModeEnabled);

  if (anyObjections == true) {
    socket.emit("objectionToClient", "????");
  }

  socket.on("pingServer", (timeStamp) => {
    socket.emit("pingClient", timeStamp);
  });

  socket.on("buzzerPressed", (newUserName, newTimeStamp) => {
    if (idkList.includes(newUserName)) {
      const userIndex = idkList.indexOf(newUserName);
      idkList.splice(userIndex, 1)
    }

    let firstBuzzTimeStamp = (() => {
      if (buzzInfo.length == 0) {
        return newTimeStamp
      }
      else {
        return buzzInfo[0].timeStamp;
      }
    });

    buzzInfo.push({
      userName: newUserName,
      timeStamp: newTimeStamp,
      lateTime: newTimeStamp - firstBuzzTimeStamp,
      buzzOrder: buzzInfo.length + 1
    });

    io.emit("buzzInfoToClient", buzzInfo);
  });

  socket.on("idkButtonPressed", (newUserName) => {
    if (!idkList.includes(newUserName) && userInfo[newUserName] != null && (userInfo[newUserName].teamName == teamsList[currentTeamNumber])) {
      idkList.push(newUserName);
      const currentTeamName = userInfo[newUserName].teamName;
      const isUserLocked = getUserOnZeroCharges(teamsList[currentTeamNumber]); // determine if a user is locked out of buzzing
      
      let teamSize = Object.values(userInfo).filter((user) => user.teamName == currentTeamName).length;
      if (isUserLocked) { teamSize--; } // reduce team size by 1 if user locked out, simulates "one less player" on the team

      io.emit("idkListToClient", idkList);

      if (idkList.length >= teamSize) {
        io.emit("passToClient", teamsList[currentTeamNumber]);
      }
    }
  });

  socket.on("scoresToServer", (score) => {
    const currentTeamName = teamsList[currentTeamNumber]
    teamsScore[currentTeamNumber] += score;

    const userBuzzed = buzzInfo.filter((user) => user.buzzOrder == 1)[0]
    if (userBuzzed) { userChargeData[userBuzzed.userName].charges--; } // decrement charges by 1 for user who buzzed in

    if (teamsScore[currentTeamNumber] >= 2) {
      teamsScore[currentTeamNumber] = 0;
      currentTeamNumber = (currentTeamNumber + 1) % 2;
    }

    buzzInfo = [];
    idkList = [];

    // add 1 charge and remove any buzzer lockout for every user on the team who did not buzz
    for (const user in userChargeData) {
      const userEntry = userChargeData[user];
      if ((userBuzzed?.userName != user) && userEntry.teamName == currentTeamName && userEntry.charges < MAX_CHARGES) {
        userEntry.charges++;
        io.emit("removeBuzzerLockouts", getUserId(user));
      }
    }

    const userToLock = getUserOnZeroCharges(teamsList[currentTeamNumber]); // determine which user's buzzer should be locked, if any

    io.emit("gameStateToClient", teamsList[currentTeamNumber], teamsScore[currentTeamNumber], isChargeModeEnabled, userChargeData);
    io.emit("clearBuzzers", teamsList[currentTeamNumber], isChargeModeEnabled, userChargeData);
    io.emit("addBuzzerLockouts", teamsList[currentTeamNumber], userToLock); // add lockout to user
  });

  socket.on("updateUserInfo", (userName, teamName, buzzerId, isChargeMode) => {
    userInfo[userName] = {
      teamName: teamName,
      buzzerId: buzzerId
    }

    // if user doesn't already exist in userList, add them
    if (!userList.some((item) => item.userName == userName)) {
      const user = { userName: userName, teamName: teamName, buzzerId: buzzerId }
      userList.push(user);
    }
    
    // update user in userList if buzzer has changed (shows on the home screen)
    const userBuzzerToUpdate = userList.find((user) => user.userName == userName && user.buzzerId != buzzerId);
    if (userBuzzerToUpdate) { userBuzzerToUpdate.buzzerId = buzzerId; }
    
    io.emit("getUserList", userList); // emit userList for home screen

    // create new entry for storing user charge data if none exists for current user
    if (!userChargeData.hasOwnProperty(userName)) {
      userChargeData[userName] = { teamName: teamName, charges: MAX_CHARGES };
    }

    io.emit("userInfoToClient", userInfo, isChargeMode, userChargeData);
    if (!isChargeMode) { return; }
    io.emit("addBuzzerLockouts", currentTeamNumber, getUserOnZeroCharges(teamsList[currentTeamNumber]));
  });

  //used by the host when they refresh the page.
  socket.on("refreshUserInfo", (isChargeMode) => {
    io.emit("userInfoToClient", userInfo, isChargeMode, userChargeData);
    if (!isChargeMode) { return; }
    io.emit("addBuzzerLockouts", currentTeamNumber, getUserOnZeroCharges(teamsList[currentTeamNumber]));
  });

  socket.on("unregisterUsers", () => {
    userInfo = new Object();
    userChargeData = new Object();
    userList = [];
    io.emit("userInfoToClient", userInfo, isChargeModeEnabled, userChargeData);
    io.emit("reconnectUsers");
    io.emit("getUserList", userList);
  });

  socket.on("toggleChargeMode", (isChargeMode) => {
    userInfo = new Object();
    userChargeData = new Object();
    userList = [];
    buzzInfo = [];
    idkList = [];
    isChargeModeEnabled = isChargeMode;
    io.emit("userInfoToClient", userInfo, isChargeModeEnabled, userChargeData);
    io.emit("reconnectUsers");
    io.emit("getUserList", userList);
  });

  socket.on("objectionToServer", (userName) => {
    if (anyObjections == false) {
      io.emit("objectionToClient", userName);
      anyObjections = true;
    }
  });

  socket.on("clearObjectionToServer", () => {
    anyObjections = false;
    io.emit("clearObjectionToClient");
  });

  socket.on("getCurrentTeam", () => {
    io.emit("currentTeam", currentTeamNumber, buzzInfo, userChargeData)
  });

  // used to populate user lists on the home page
  socket.on("onHomepageLoad", () => {
    io.emit("getUserList", userList);
  })
});

// const io = new Server(server);
const port = 8080;
server.listen(port);

app.get("/", (req, res) => {
  res.sendFile("pages/home.html", { root: __dirname });
});

app.get("/host", (req, res) => {
  if (isChargeModeEnabled) {
    return res.redirect("/host-charges" + req.url.replace("/host", ""));
  }
  res.sendFile("pages/host.html", { root: __dirname });
});

// redirect host to host-charges if charge mode is enabled
app.get("/host-charges", (req, res) => {
  if (!isChargeModeEnabled) {
    return res.redirect("/host" + req.url.replace("/host-charges", ""));
  }
  res.sendFile("pages/host.html", { root: __dirname });
});

app.get("/play", (req, res) => {
  if (isChargeModeEnabled) {
    return res.redirect("/play-charges" + req.url.replace("/play", ""));
  }
  res.sendFile("pages/play.html", { root: __dirname });
});

// redirect users to play-charges if charge mode is enabled
app.get("/play-charges", (req, res) => {
  if (!isChargeModeEnabled) {
    return res.redirect("/play" + req.url.replace("/play-charges", ""));
  }
  res.sendFile("pages/play.html", { root: __dirname });
});

app.get("/browserFunctions.js", (req, res) => {
  res.sendFile("/browserFunctions.js", { root: __dirname });
});

app.post("/reset", (req, res) => {
  resetApp();
  res.redirect("/");
});

//all files in these folders can be accessed with a GET request of the filename
let assetFolders = ["styles", "pages", "images", "images/buzzers", "audio", "fonts"];
assetFolders.forEach((folderName) => {
  let folderContents = fs.readdirSync(folderName);
  folderContents.forEach((fileName) => {
    app.get("/" + fileName, (req, res) => {
      res.sendFile(folderName + "/" + fileName, { root: __dirname });
    });
  });
});