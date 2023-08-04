
var myName = "";
var currentMap = "sanhok";
var currentPhase = "lobby";
var teamMembers = [];
var plane = {
  start: undefined,
  end: undefined
};
var flightPath = undefined;
var currentDamageDealt = 0;
var currentKills = 0;
var currentHeadshots = 0;
var currentMaxKillDistance = 0;

function lobbyClear() {
  // clear local data
  teamMembers = [];
  plane = {
    start: undefined,
    end: undefined
  };
  flightPath = undefined;
  currentDamageDealt = 0;
  currentKills = 0;
  currentHeadshots = 0;
  currentMaxKillDistance = 0;

  //clear data on server
  jsonpkg = {
    "name": myName,
  };
  jQuery.post("http://pubg.buck.ly/api/lobbyclear.php", jsonpkg, function(response) {  }, 'json');
}

function setMap(mapname) {
  currentMap = mapname;
  console.log("The current map is " + currentMap);

  jsonpkg = {
    "name": myName,
    "map": currentMap
  };
  jQuery.post("http://pubg.buck.ly/api/setmap.php", jsonpkg, function(response) {  }, 'json');
}

function updateFlightPath() {
  if (plane.start && plane.end) {
    flightPath = calculateFlightPath();
    jsonpkg = {
      "name": myName,
      "flightpath": flightPath
    };
    jQuery.post("http://pubg.buck.ly/api/setfpath.php", jsonpkg, function(response) {  }, 'json');
  }
}

function setPhase(phase) {
  currentPhase = phase;
  if (phase === "aircraft") {
    attemptNameFetch();
  }
  if (phase === "lobby") {
     lobbyClear();
  }
  if (phase === "freefly") {
    if (plane.start && plane.end) {
      plane.start = undefined;
      plane.end = undefined;
    }
  }
  console.log("Now in the '" + phase + "' phase.");

  jsonpkg = {
    "name": myName,
    "phase": currentPhase
  };
  jQuery.post("http://pubg.buck.ly/api/setphase.php", jsonpkg, function(response) {  }, 'json');
}

function setName(name) {
  myName = name;
  localStorage.setItem('pubgname', name);
  console.log("The player's name is '" + name + "'");
  // when we get a name, make sure the server has rows set up for this user
  jQuery.post("http://pubg.buck.ly/api/readyplayer.php", {name: myName}, function(response) { 
    // also update the team now, as it might have been lost if the user's very first game is in a team
    setTeam(teamMembers);
  }, 'json');
}

function setTeam(squadmates) {
  teamMembers = squadmates;

  newSquad = [];
  for (i=0; i<teamMembers.length; i++) {
    if (!(teamMembers[i] === myName)) {
      newSquad.push(teamMembers[i]);
    }
  }

  console.log("The player's team is: " + JSON.stringify(newSquad));

  if (getName() === "") {
    console.log("Ignoring squad update as the player name is not yet known.");
    return;
  }

  jsonpkg = {
    "name": myName,
    "mates": newSquad
  };

  jQuery.post("http://pubg.buck.ly/api/team.php", jsonpkg, function(response) {  }, 'json');

}

function calculateFlightPath() {
  var start = JSON.parse(plane.start);
  var end = JSON.parse(plane.end);

  var startX = start.x;
  var startY = start.y;
  var endX = end.x;
  var endY = end.y;

  var mSize = mapSize(currentMap);

  var offX = endX - startX;
  var offY = endY - startY;

  var dx = offX < 0 ? 0 : mSize;
  var dy = offY < 0 ? 0 : mSize;
  var py = dy;

  var sx = offX > 0 ? 0 : mSize;
  var sy = offY > 0 ? 0 : mSize;
  var ty = sy;

  if (offX === 0) {
    return {
      start: { x:startX, y:endY>startY ? 0 : mSize },
      end:   { x:startX, y:endY>startY ? mSize : 0 }
    }
  } else if (offY === 0) {
    return {
      start: { x:endX>startX ? 0 : mSize, y:starY },
      end:   { x:endX>startX ? mSize : 0, y:starY }
    }
  } else {
    dy = startY + (offY / offX) * (dx - startX);
    if (dy < 0 || dy > mSize) {
      dx = startX + (offX / offY) * (py - startY);
      dy = py;
    }

    sy = endY + (offY / offX) * (sx - endX);
    if (sy < 0 || sy > mSize) {
      sx = startX + (offX / offY) * (ty - startY);
      sy = ty;
    }
  }
	return {start: {x:sx, y:sy}, end: {x:dx, y:dy}}
}

function setLocation(loc) {
  if (currentPhase === "aircraft") {
    if (plane.start === undefined) {
      plane.start = loc;
    } else {
      plane.end = loc;
    }
    updateFlightPath();
  }

  if (nameKnown === false) {
    console.log("Ignoring location update as the player name is not yet known.");
    return;
  }

  jsonpkg = {
    "name": myName,
    "location": loc
  };
  
  // post data to server
  jQuery.post("http://pubg.buck.ly/api/loc.php", jsonpkg, function(response) {  }, 'json');
}

function setTotalDamageDealt(damagedealt) {
  currentDamageDealt = damagedealt;
  jsonpkg = {
    "name": myName,
    "damagedealt": damagedealt
  };
  jQuery.post("http://pubg.buck.ly/api/setdamagedealt.php", jsonpkg, function(response) {  }, 'json');
}

function setKills(kills) {
  currentKills = kills;
  jsonpkg = {
    "name": myName,
    "kills": kills
  };
  jQuery.post("http://pubg.buck.ly/api/setkills.php", jsonpkg, function(response) {  }, 'json');
}

function setHeadshots(headshots) {
  currentHeadshots = headshots;
  jsonpkg = {
    "name": myName,
    "headshots": headshots
  };
  jQuery.post("http://pubg.buck.ly/api/setheadshots.php", jsonpkg, function(response) {  }, 'json');
}

function setMaxKillDistance(maxkilldist) {
  currentMaxKillDistance = maxkilldist;
  jsonpkg = {
    "name": myName,
    "maxkilldist": maxkilldist
  };
  jQuery.post("http://pubg.buck.ly/api/setmaxkilldist.php", jsonpkg, function(response) {  }, 'json');
}




// try to fetch the player's name, do nothing if you fail.
function attemptNameFetch() {
  overwolf.games.events.getInfo(function(data){
    if (data && data.res && data.res.me && data.res.me.name) {
      setName(data.res.me.name);
    }
  });
}

function nameKnown() {
  if (myName === "") return false;
  return true;
}

function getName() {
  if (myName === "") {
    if (localStorage.getItem('pubgname') === null) {
      attemptNameFetch();
      return "";
    } else {
      myName = localStorage.getItem('pubgname');
      return myName;
    }
  } else {
    if (localStorage.getItem('pubgname') === null) {
      localStorage.setItem('pubgname', myName);
    }
    return myName;
  }
}


function getMapName(simpleMapName) {
  if (simpleMapName == "Savage_Main") return "sanhok";
  if (simpleMapName == "Erangel_Main") return "erangel";
  if (simpleMapName == "Desert_Main") return "miramar";
  if (simpleMapName == "DihorOtok_Main") return "vikendi";
  console.log("Unknown map name: " + simpleMapName);
  return "unknown";
}

function mapSize(mapname) {
  if (mapname === "sanhok")  return 4000;
  if (mapname === "vikendi") return 6000;
  return 8000;
}

//register event listeners for all the events we are interested in.
var registered = false;
function registerEvents() {
  // making sure this function only runs once
  if (registered) return;
  registered = true;

  //see if we can get the user name already.
  getName();

  // general events errors
  overwolf.games.events.onError.addListener(function(info) {
    console.log("Overwolf events error: " + JSON.stringify(info));
  });

  // "game info updates" data changed
  overwolf.games.events.onInfoUpdates2.addListener(function(info) {
    // if location is given in this update
    if (info.feature == "location") {
      setLocation(info.info.game_info.location);
    } else if(info.feature == "team") {
      teammembersobj = JSON.parse(info.info.match_info.nicknames);
      setTeam(teammembersobj.team_members);
    } else if(info.feature == "phase") {
      setPhase(info.info.game_info.phase);
    } else if(info.feature == "map") {
      setMap(getMapName(info.info.match_info.map));
    } else if(info.feature == "roster") {
      console.log("Ignoring roster update.");
    } else if(info.feature == "me") {
      setName(info.info.me.name);
    } else if(info.feature == "kill") {
      if (info.info.match_info) {
        if (info.info.match_info.total_damage_dealt) {
          setTotalDamageDealt(info.info.match_info.total_damage_dealt);
        }
        if (info.info.match_info.kills) {
          setKills(info.info.match_info.kills);
        }
        if (info.info.match_info.headshots) {
          setHeadshots(info.info.match_info.headshots);
        }
        if (info.info.match_info.max_kill_distance) {
          setMaxKillDistance(info.info.match_info.max_kill_distance);
        }
      }
    } else {
      console.log("Other Info Update: " + JSON.stringify(info));
    }
  });


  // an event triggerd
  overwolf.games.events.onNewEvents.addListener(function(info) {
    console.log("EVENT FIRED: " + JSON.stringify(info));
  });
}


function gameLaunched(gameInfoResult) {
  if (!gameInfoResult) {
    return false;
  }

  if (!gameInfoResult.gameInfo) {
    return false;
  }

  if (!gameInfoResult.runningChanged && !gameInfoResult.gameChanged) {
    return false;
  }

  if (!gameInfoResult.gameInfo.isRunning) {
    return false;
  }

  // NOTE: we divide by 10 to get the game class id without it's sequence number
  if (Math.floor(gameInfoResult.gameInfo.id/10) != 10906) {
    return false;
  }

  console.log("PUBG Launched");
  return true;

}

function gameRunning(gameInfo) {

  if (!gameInfo) {
    return false;
  }

  if (!gameInfo.isRunning) {
    return false;
  }

  // NOTE: we divide by 10 to get the game class id without it's sequence number
  if (Math.floor(gameInfo.id/10) != 10906) {
    return false;
  }

  console.log("PUBG running");
  return true;

}


function setFeatures() {
  var g_interestedInFeatures = [
    'me',
    'kill',
    'revived',
    'death',
    'killer',
    'match',
    'rank',
    'location',
    'team',
    'phase',
    'map'
  ];
  overwolf.games.events.setRequiredFeatures(g_interestedInFeatures, function(info) {
    if (info.status == "error")
    {
      console.log("Could not set required features: " + info.reason);
      console.log("Trying in 2 seconds");
      window.setTimeout(setFeatures, 2000);
      return;
    }

    console.log("Set required features:");
    console.log(JSON.stringify(info));
  });
}


// Start here
overwolf.games.onGameInfoUpdated.addListener(function (res) {
  if (gameLaunched(res)) {
    registerEvents();
    setTimeout(setFeatures, 1000);
  }
  console.log("onGameInfoUpdated: " + JSON.stringify(res));
});

overwolf.games.getRunningGameInfo(function (res) {
  if (gameRunning(res)) {
    registerEvents();
    setTimeout(setFeatures, 1000);
  }
  console.log("getRunningGameInfo: " + JSON.stringify(res));
});

getName();