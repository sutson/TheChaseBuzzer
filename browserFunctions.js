var buzzerCache = new Map();

function userInfoToClient(userInfo, isChargeMode, userChargeData) {
  for (const user in userInfo) {
    re = new RegExp("\\W", "g");
    const userId = user.replaceAll(re, "_");

    buzzerCache.set(userInfo[user].buzzerId, new Audio(`${userInfo[user].buzzerId}.mp3`));

    if ($("#userListPanel").find(`#${userId}`).length >= 1) {
      //update buzzer icon of existing user
      $("#userListPanel").find(`#${userId}`).find("img").attr("data-buzzerId", userInfo[user].buzzerId);
      $("#userListPanel").find(`#${userId}`).find("img").attr("src", `${userInfo[user].buzzerId}.png`);
    }
    else {
      //new user
      const buzzerIcon = `<img src=${userInfo[user].buzzerId}.png data-buzzerId=${userInfo[user].buzzerId} class=userListBuzzerSelections>`
      const userText = `${user}${(isChargeMode ? `<var id=chargeBlocks>${getChargeBlocks(userChargeData[user].charges)}</var>` : "")}` // user name with charges, if applicable
      $(`#${userInfo[user].teamName}List`)
        .find("ul")
        .append(
          `<li id=${userId}>${buzzerIcon}${userText}<var id=${userId}></var></li>`
        );
    }
  }
}

// creates visual representation of charges remaining for a user
function getChargeBlocks(charges) {
  let blockHtml = "";

  for (let i = 3; i > 0; i--) {
    blockHtml += charges >= i ? "■" : "";
  }

  return blockHtml;
}

function gameStateToClient(currentTeam, currentScore, isChargeMode, userChargeData) {
  $("#PlayersList").css("opacity", 0.5);
  $("#ChasersList").css("opacity", 0.5);
  $(`#${currentTeam}List`).css("opacity", 1);

  // TODO: do i need this?
  // if (isChargeMode && currentTeam == "Players") {
  //   for (const user in userChargeData) {
  //     const userEntry = userChargeData[user];
  //     if (userEntry.charges == 0) {
  //       toggleBuzzer(false);
  //       toggleUserOpacity(user.replaceAll(" ", "_"), true);
  //     }
  //   }
  // }

  $("#currentTeam").html(`${currentTeam} Turn`);
  $("#currentScore").html(currentScore);
}

function clearBuzzers(_, isChargeMode, userChargeData) {
  $("#firstBuzz").html("");
  for (const user in userChargeData) {
    const userId = getUserId(user);
    $("#userListPanel").find("#" + userId).find(`var#${userId}`).html("");
    if (isChargeMode) {
      $("#userListPanel").find("#" + userId).find("var#chargeBlocks").html(getChargeBlocks(userChargeData[user].charges));
    };
  }
}

function buzzInfoToClient(buzzInfo, soundOn) {
  //play sound for first buzz in
  if ($("#firstBuzz").html() == "") {
    $("#firstBuzz").html(buzzInfo[0].userName);
    const userId = getUserId(buzzInfo[0].userName);
    let buzzerId = $("#userListPanel").find("#" + userId).find("img").attr("data-buzzerId");
    let buzzerSound = buzzerCache.get(buzzerId);
    if (soundOn == true) {
      buzzerSound.play();
    }
  }

  for (let i = 0; i < buzzInfo.length; i++) {
    const userId = getUserId(buzzInfo[i].userName);
    $("#userListPanel").find("#" + userId).find("var").last().html(" [" + buzzInfo[i].buzzOrder + "]");
  }
}

function idkListToClient(idkList) {
  idkList.forEach((userName) => {
    const userId = getUserId(userName);
    $("#userListPanel").find("#" + userId).find("var").last().html("<div style='display: inline; font-family: Times New Roman; font-size: 20px;'> ¯\\\_(ツ)_/¯</div>");
  });
}

function passToClient(teamName, soundOn) {
  let passSound = new Audio("PikminDeath.mp3");
  if (soundOn == true) {
    passSound.play();
  }
  $("#firstBuzz").html(teamName + " have Passed!");
  toggleBuzzer(false);
}

let objectionSound = new Audio("AAObjection.mp3");
function objectionToClient(userName) {
  // objectionSound.play();
  $("#objection").html("<img src='AAObjection.gif?" + Math.random() + "'><br>" + userName + " is objecting!<br>");
}

function clearObjectionToClient() {
  $("#objection").html("");
}

function toggleBuzzer(isEnabled) {
  $("#buzzer").css("opacity", isEnabled ? "1" : "0.5");
  $("#buzzer").css("cursor", isEnabled ? "pointer" : "not-allowed");
  buzzable = isEnabled;
}

function toggleIdk(isEnabled) {
  $("#idkButton").css("opacity", isEnabled ? "1" : "0.5");
  $("#idkButton").css("cursor", isEnabled ? "pointer" : "not-allowed");
  idkButtonClickable = isEnabled;
}

function toggleUserOpacity(userId, isInactive) {
  $(`li#${userId}`).css("opacity", isInactive ?  "0.5" : "1");
}

function getUserId(userName) {
  return userName.replaceAll(" ", "_");
}