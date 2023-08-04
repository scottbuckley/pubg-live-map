
/*
     ######   ##        #######  ########     ###    ##        ######
    ##    ##  ##       ##     ## ##     ##   ## ##   ##       ##    ##
    ##        ##       ##     ## ##     ##  ##   ##  ##       ##
    ##   #### ##       ##     ## ########  ##     ## ##        ######
    ##    ##  ##       ##     ## ##     ## ######### ##             ##
    ##    ##  ##       ##     ## ##     ## ##     ## ##       ##    ##
     ######   ########  #######  ########  ##     ## ########  ######
*/

// constants
const APIPATH = "http://dev.pubg.buck.ly/api/";
const localStorageNameKey = "pubgname10";
var overwolf_debug = false; // print debug logs for OW interaction.

// how often (in ms) a roster is sent to the server during "airfield" phase
const rosterTime = 5000;

// whether or not to get the whole inventory from the API every x seconds.
// right now the api is buggy AF in that regard.
// right now we are using the "weaponState" feature to deal with main weapons,
// and using inventory update events for everything else. This seems to work,
// but it has its limitations.
const getFullInv = false;
const getFullInvTime = 6000;


// the server's record of all these things are the most important,
// but we keep track of it all here so we know when something has
// changed and we can cope better with lost requests, avoid redundant
// updates, etc.

// game state
var currentMap   = "unknown";
var currentPhase = "lobby";
var currentMode  = "solo";

// Personal data
var myName                 = "";
var currentKills           = 0;
var currentKnocks          = 0;
var currentHeadshots       = 0;
var currentMaxKillDistance = 0;
var currentDamageDealt     = 0;
var currentDowns           = 0;
var currentWpnHeld         = 0;
var currentLatency         = 0;

// team data
var teamMembers = []; // list of teammate names (non-assoc)
var teamData    = []; // more detailed data about teammates (associative)

// roster
var currentRoster = [];

// flight path and plane
// var flightPath = undefined;
// var plane = {
//   start: undefined,
//   end: undefined
// };

// zones
var currentWhiteZone = undefined;
var currentBlueZone  = undefined;
var currentRedZone   = undefined;

// the data that needs to be sent with the next location or timeout update.
// this is regularly sent to the server and cleared
var updateBuffer = {};




/*
 ##     ## ########  ########     ###    ######## ######## 
 ##     ## ##     ## ##     ##   ## ##      ##    ##       
 ##     ## ##     ## ##     ##  ##   ##     ##    ##       
 ##     ## ########  ##     ## ##     ##    ##    ######   
 ##     ## ##        ##     ## #########    ##    ##       
 ##     ## ##        ##     ## ##     ##    ##    ##       
  #######  ##        ########  ##     ##    ##    ######## 
*/


// send all new info. this will happen automatically
// every x ms, but if it is called manually that timer
// will reset. It is usually called on a location update.
var newInfoIntervalRate = 1200;
function sendNewInfo() {
  // grab the update buffer, and put a new one up.
  var payload = updateBuffer;
  updateBuffer = {};

  if (Object.keys(payload).length===0)
    return; // nothing to send

  // add the player's name to the payload
  payload.name = myName;

  // send the payload to update.php
  jQuery.post(APIPATH+"update.php", payload, function(r) {  }, 'json');

  // start a timer to do this again
  restartNewInfoInterval();
}

// wait another x ms before calling sendNewInfo again.
var newInfoInterval = undefined;
function restartNewInfoInterval() {
  clearInterval(newInfoInterval);
  setInterval(sendNewInfo, newInfoIntervalRate);
}



// this will happen when we get the player name. we will send heaps of
// local info to the server. instead of making a new API call for this,
// we just call all of the existing update functions.
function sendAllInfo() {
  console.log("Player's name found. Sending info package to server.");

  // set map, flightpath, phase, mode, team, roster.
  // the rest should happen over time.
  setPhase(currentPhase);
  setMap(currentMap);
  setMode(currentMode);
  setTeam(teamMembers);
  // updateFlightPath();
  maybeSendFlightPath();
  sendRoster();

  sendNewInfo();
}




/*
 ########  ##     ##    ###     ######  ######## 
 ##     ## ##     ##   ## ##   ##    ## ##       
 ##     ## ##     ##  ##   ##  ##       ##       
 ########  ######### ##     ##  ######  ######   
 ##        ##     ## #########       ## ##       
 ##        ##     ## ##     ## ##    ## ##       
 ##        ##     ## ##     ##  ######  ######## 
*/


// set the phase, both locally and on the server.
// there are some extra actions that happen when we enter different phases too.
function setPhase(phase) {
  currentPhase = phase;

  // since we're not quite sure when "mode" is updated, try to get it at the
  // start of every phase.
  attemptModeFetch();

  if (phase === "lobby") {
    // when back in the lobby, clear all player/match information.
    onLobby();
    stopSendingInventory();
  }

  // (there are no special actions for the "loading_screen" phase change)

  // the roster will only be updated while in the airfield.
  if (phase === "airfield") startSendingRoster();
  else stopSendingRoster();

  if (phase === "aircraft") {
    resetPlanePos();
    // plane.start = undefined;
    // plane.end = undefined;

    sendRoster(); // send the roster one last time in the aircraft, just to be safe.

    // we try to get the name like 100 different ways because its so important to know and 
    // the API doesn't give us the info reliably. We manually ask for it once in the aircraft.
    attemptNameFetch();

    // start sending the inventory regularly (when there are changes)
    startSendingInventory();
  }

  if (phase === "freefly") {
    // no longer update the plane position, as the player is no longer in the plane.
    // if (plane.start && plane.end) {
    //   plane.start = undefined;
    //   plane.end = undefined;
    // }
    clearTrustedArrays();
  }

  // (there are no special actions for the "landed" phase change)

  console.log("Now in the '" + phase + "' phase.");

  updateBuffer.phase = currentPhase;

  // // tell the server about the new phase
  // jsonpkg = {
  //   "name": myName,
  //   "phase": currentPhase
  // };
  // jQuery.post(APIPATH+"setphase.php", jsonpkg, function(r) {  }, 'json');
}


// called when the user is in the lobby. clears all their important
// info, both here and on the server.
function onLobby() {
  // clear local data

  // inventory
  clearInventory();
  recentWeaponsHeld = [];

  // Personal data
  currentKills           = 0;
  currentKnocks          = 0;
  currentHeadshots       = 0;
  currentMaxKillDistance = 0;
  currentDamageDealt     = 0;
  currentDowns           = 0;
  currentWpnHeld         = 0;
  currentLatency         = 0;
  
  // team data
  teamMembers = []; // list of teammate names (non-assoc)
  teamData    = []; // more detailed data about teammates (associative)
  
  // roster
  currentRoster = [];
  
  // flight path and plane
  resetPlanePos();
  // flightPath = undefined;
  // plane = {
  //   start: undefined,
  //   end: undefined
  // };
  
  // zones
  currentWhiteZone = undefined;
  currentBlueZone  = undefined;
  currentRedZone   = undefined;

  // tell the server to clear everything as we are in the lobby.
  jsonpkg = { "name": myName, };
  jQuery.post(APIPATH+"lobbyclear.php", jsonpkg, function(r) {  }, 'json');
}


/*
 #### ##    ## ##     ## ######## ##    ## ########  #######  ########  ##    ## 
  ##  ###   ## ##     ## ##       ###   ##    ##    ##     ## ##     ##  ##  ##  
  ##  ####  ## ##     ## ##       ####  ##    ##    ##     ## ##     ##   ####   
  ##  ## ## ## ##     ## ######   ## ## ##    ##    ##     ## ########     ##    
  ##  ##  ####  ##   ##  ##       ##  ####    ##    ##     ## ##   ##      ##    
  ##  ##   ###   ## ##   ##       ##   ###    ##    ##     ## ##    ##     ##    
 #### ##    ##    ###    ######## ##    ##    ##     #######  ##     ##    ##    
*/

// local player's inventory
var currentInventory = buildEmptyInventory();

// queue of the two most recent (unique) main weapons held
var recentWeaponsHeld = [];

// a representation of the state of the inventory
var listInventory = [];
// ... and equipment
var listEquip = [];

// a list of which 'slots' in the inventory and equipment are 'trusted';
// this means they have been updated this game by the API.
var trustedInv = [];
var trustedEquip = [];

function clearInventory(clearTrusted = true) {
  currentInventory = buildEmptyInventory();
  savedInventory = "";
  listInventory = [];
  listEquip = [];
  if (clearTrusted) {
    clearTrustedArrays();
  }
}

function clearTrustedArrays() {
  trustedInv = [];
  trustedEquip = [];
}

function buildEmptyInventory() {
  var inv = {};
  // gear
  inv.helmet = inv.vest = inv.bag = inv.ghillie = 0;

  // main weapons
  inv.wepClose = inv.wepRange = 0;

  // secondary weapons
  inv.melee = inv.belt = inv.pistol = 0;

  // meds
  inv.medKits = inv.firstAids = inv.bandages = inv.adrenalines = inv.painKillers = inv.energies = 0;

  // throwables
  inv.frags = inv.mollies = inv.smokes = inv.flashes = 0;

  return inv;
}

function ensureItem(item) {
  if (item && item.name && item.name)
    return item;
  return undefined;
}

function processInvChange(oldItem, newItem, equip=false) {
  // we know that the old item is being replaced by
  // the new item. so remove the old item (if it exists),
  // and we add the new item (if it exists)

  newItem = ensureItem(newItem);
  oldItem = ensureItem(oldItem);

  if (oldItem!==undefined) {
    // remove the old item
    removeItem(oldItem.name, equip);
  }

  if (newItem!==undefined) {
    // add the new item
    addItem(newItem.name, newItem.count, equip);
  }
}


var mainWepCap = 33;
var mainWepList = [
  // Main Weapons
  "Item_Weapon_Berreta686_C",    // 1
  "Item_Weapon_Winchester_C",    // 2
  "Item_Weapon_Saiga12_C",       // 3
  "Item_Weapon_DP12_C",          // 4
  "Item_Weapon_UZI_C",           // 5
  "Item_Weapon_Thompson_C",      // 6
  "Item_Weapon_Vector_C",        // 7
  "Item_Weapon_BizonPP19_C",     // 8
  "Item_Weapon_UMP_C",           // 9
  "Item_Weapon_Groza_C",         // 10
  "Item_Weapon_M249_C",          // 11
  "Item_Weapon_AK47_C",          // 12
  "Item_Weapon_BerylM762_C",     // 13
  "Item_Weapon_DP28_C",          // 14
  "Item_Weapon_AUG_C",           // 15
  "Item_Weapon_MP5K_C",          // 16
  "Item_Weapon_SCAR-L_C",        // 17
  "Item_Weapon_QBZ95_C",         // 18
  "Item_Weapon_HK416_C",         // 19
  "Item_Weapon_G36C_C",          // 20
  "Item_Weapon_Mk47Mutant_C",    // 21
  "Item_Weapon_M16A4_C",         // 22
  "Item_Weapon_Win1894_C",       // 23
  "Item_Weapon_Mk14_C",          // 24
  "Item_Weapon_QBU88_C",         // 25
  "Item_Weapon_Mini14_C",        // 26
  "Item_Weapon_VSS_C",           // 27
  "Item_Weapon_SKS_C",           // 28
  "Item_Weapon_FNFal_C",         // 29
  "Item_Weapon_Crossbow_C",      // 30
  "Item_Weapon_Kar98k_C",        // 31
  "Item_Weapon_M24_C",           // 32
  "Item_Weapon_AWM_C",           // 33
  // Throwables
  "Item_Weapon_Grenade_C",      // 34
  "Item_Weapon_Molotov_C",      // 35
  "Item_Weapon_SmokeBomb_C",    // 36
  "Item_Weapon_FlashBang_C",    // 37
  // Pistols
  "Item_Weapon_FlareGun_C",     // 38
  "Item_Weapon_DesertEagle_C",  // 39
  "Item_Weapon_G18_C",          // 40
  "Item_Weapon_M1911_C",        // 41
  "Item_Weapon_M9_C",           // 42
  "Item_Weapon_NagantM1895_C",  // 43
  "Item_Weapon_Rhino_C",        // 44
  "Item_Weapon_Sawnoff_C",      // 45
  "Item_Weapon_vz61Skorpion_C", // 46
  // Melee
  "Item_Weapon_Cowbar_C",       // 47
  "Item_Weapon_Machete_C",      // 48
  "Item_Weapon_Pan_C",          // 49
  "Item_Weapon_Sickle_C",       // 50
];

var shitWepList = [
  // Main Weapons
  "WeapBerreta686_C",   // 1
  "WeapWinchester_C",   // 2
  "WeapSaiga12_C",      // 3
  "WeapDP12_C",         // 4
  "WeapUZI_C",          // 5
  "WeapThompson_C",     // 6
  "WeapVector_C",       // 7
  "WeapBizonPP19_C",    // 8
  "WeapUMP_C",          // 9
  "WeapGroza_C",        // 10
  "WeapM249_C",         // 11
  "WeapAK47_C",         // 12
  "WeapBerylM762_C",    // 13
  "WeapDP28_C",         // 14
  "WeapAUG_C",          // 15
  "WeapMP5K_C",         // 16
  "WeapSCAR-L_C",       // 17
  "WeapQBZ95_C",        // 18
  "WeapHK416_C",        // 19
  "WeapG36C_C",         // 20
  "WeapMk47Mutant_C",   // 21
  "WeapM16A4_C",        // 22
  "WeapWin94_C",      // 23
  "WeapMk14_C",         // 24
  "WeapQBU88_C",        // 25
  "WeapMini14_C",       // 26
  "WeapVSS_C",          // 27
  "WeapSKS_C",          // 28
  "WeapFNFal_C",        // 29
  "WeapCrossbow_C",     // 30
  "WeapKar98k_C",       // 31
  "WeapM24_C",          // 32
  "WeapAWM_C",          // 33
  // Throwables
  "WeapGrenade_C",      // 34
  "WeapMolotov_C",      // 35
  "WeapSmokeBomb_C",    // 36
  "WeapFlashBang_C",    // 37
  // Pistols
  "WeapFlareGun_C",     // 38
  "WeapDesertEagle_C",  // 39
  "WeapG18_C",          // 40
  "WeapM1911_C",        // 41
  "WeapM9_C",           // 42
  "WeapNagantM1895_C",  // 43
  "WeapRhino_C",        // 44
  "WeapSawnoff_C",      // 45
  "Weapvz61Skorpion_C", // 46
  // Melee
  "WeapCowbar_C",       // 47
  "WeapMachete_C",      // 48
  "WeapPan_C",          // 49
  "WeapSickle_C",       // 50
];

function addItem(itemName, itemCount, equip=false) {
  var inv = currentInventory;
  var sw = (st) => itemName.startsWith(st);

  if (itemName===null || itemName===undefined) return;

  // weapon
  if (sw("Item_Weapon_")) {
    if (equip) {
      // Throwables
           if (sw("Item_Weapon_Grenade_"))   inv.belt = 34;
      else if (sw("Item_Weapon_Molotov_"))   inv.belt = 35;
      else if (sw("Item_Weapon_SmokeBomb_")) inv.belt = 36;
      else if (sw("Item_Weapon_FlashBang_")) inv.belt = 37;
      // Pistol
      else if (sw("Item_Weapon_FlareGun_"))     inv.pistol = 38;
      else if (sw("Item_Weapon_DesertEagle_"))  inv.pistol = 39;
      else if (sw("Item_Weapon_G18_"))          inv.pistol = 40;
      else if (sw("Item_Weapon_M1911_"))        inv.pistol = 41;
      else if (sw("Item_Weapon_M9_"))           inv.pistol = 42;
      else if (sw("Item_Weapon_NagantM1895_"))  inv.pistol = 43;
      else if (sw("Item_Weapon_Rhino_"))        inv.pistol = 44;
      else if (sw("Item_Weapon_Sawnoff_"))      inv.pistol = 45;
      else if (sw("Item_Weapon_vz61Skorpion_")) inv.pistol = 46;
      // Melee
      else if (sw("Item_Weapon_Cowbar_"))  inv.melee = 47;
      else if (sw("Item_Weapon_Machete_")) inv.melee = 48;
      else if (sw("Item_Weapon_Pan_"))     inv.melee = 49;
      else if (sw("Item_Weapon_Sickle_"))  inv.melee = 50;
      else {
        // analyseEquippedWeapons(); // for now we will use weaponState for equipped weapons
      }
    } else {
           if (sw("Item_Weapon_Grenade_"))   inv.frags = 1;
      else if (sw("Item_Weapon_Molotov_"))   inv.mollies = 1;
      else if (sw("Item_Weapon_SmokeBomb_")) inv.smokes = 1;
      else if (sw("Item_Weapon_FlashBang_")) inv.flashes = 1;
    }
  }

  // helmet
  else if (sw("Item_Head_")) {
         if (sw("Item_Head_E_")) inv.helmet = 1;
    else if (sw("Item_Head_F_")) inv.helmet = 2;
    else if (sw("Item_Head_G_")) inv.helmet = 3;
    else console.log("Unknown helmet: " + itemName);
  }

  // vest
  else if (sw("Item_Armor_")) {
         if (sw("Item_Armor_E")) inv.vest = 1;
    else if (sw("Item_Armor_D")) inv.vest = 2;
    else if (sw("Item_Armor_C")) inv.vest = 3;
    else console.log("Unknown vest: " + itemName);
  }

  // bag
  else if (sw("Item_Back_")) {
         if (sw("Item_Back_E")) inv.bag = 1;
    else if (sw("Item_Back_F")) inv.bag = 2;
    else if (sw("Item_Back_C")) inv.bag = 3;
    else if (sw("Item_Back_B")) inv.bag = 9; // parachute
    else console.log("Unknown bag: " + itemName);
  }

  // ghillie
  else if (sw("Item_Ghillie_")) {
         if (sw("Item_Ghillie_01")) inv.ghillie = 1;
    else if (sw("Item_Ghillie_02")) inv.ghillie = 2;
    else if (sw("Item_Ghillie_03")) inv.ghillie = 3;
    else if (sw("Item_Ghillie_04")) inv.ghillie = 4;
    else console.log("Unknown ghillie: " + itemName);
  }

  // meds
  else if (sw("Item_Heal_") || sw("Item_Boost_")) {
         if (sw("Item_Heal_MedKit_"))             inv.medKits     = itemCount;
    else if (sw("Item_Heal_FirstAid_"))           inv.firstAids   = itemCount;
    else if (sw("Item_Heal_Bandage_"))            inv.bandages    = itemCount;
    else if (sw("Item_Boost_AdrenalineSyringe_")) inv.adrenalines = itemCount;
    else if (sw("Item_Boost_EnergyDrink_"))       inv.energies    = itemCount;
    else if (sw("Item_Boost_PainKiller_"))        inv.painKillers = itemCount;
    else console.log("Unknown meds: " + itemName);
  }
}

function removeItem(itemName, equip=false) {
  if (itemName===null || itemName===undefined) return;

  var inv = currentInventory;
  var sw  = (st) => itemName.startsWith(st);

  // weapon
  if (sw("Item_Weapon_")) {
         if (sw("Item_Weapon_Grenade_"))   inv.frags = 0;
    else if (sw("Item_Weapon_Molotov_"))   inv.mollies = 0;
    else if (sw("Item_Weapon_SmokeBomb_")) inv.smokes = 0;
    else if (sw("Item_Weapon_FlashBang_")) inv.flashes = 0;
    else if (equip) {
      // Throwables
           if (sw("Item_Weapon_Grenade_"))   inv.belt = 0;
      else if (sw("Item_Weapon_Molotov_"))   inv.belt = 0;
      else if (sw("Item_Weapon_SmokeBomb_")) inv.belt = 0;
      else if (sw("Item_Weapon_FlashBang_")) inv.belt = 0;
      // Pistol
      else if (sw("Item_Weapon_FlareGun_"))     inv.pistol = 0;
      else if (sw("Item_Weapon_DesertEagle_"))  inv.pistol = 0;
      else if (sw("Item_Weapon_G18_"))          inv.pistol = 0;
      else if (sw("Item_Weapon_M1911_"))        inv.pistol = 0;
      else if (sw("Item_Weapon_M9_"))           inv.pistol = 0;
      else if (sw("Item_Weapon_NagantM1895_"))  inv.pistol = 0;
      else if (sw("Item_Weapon_Rhino_"))        inv.pistol = 0;
      else if (sw("Item_Weapon_Sawnoff_"))      inv.pistol = 0;
      else if (sw("Item_Weapon_vz61Skorpion_")) inv.pistol = 0;
      // Melee
      else if (sw("Item_Weapon_Cowbar_"))  inv.melee = 0;
      else if (sw("Item_Weapon_Machete_")) inv.melee = 0;
      else if (sw("Item_Weapon_Pan_"))     inv.melee = 0;
      else if (sw("Item_Weapon_Sickle_"))  inv.melee = 0;
      else {
        // analyseEquippedWeapons(); // for now we will use weaponState for equipped weapons
      }
    }
  }

  // gear
  else if (sw("Item_Head_"))    inv.helmet = 0;
  else if (sw("Item_Armor_"))   inv.vest = 0;
  else if (sw("Item_Back_"))    inv.bag = 0;
  else if (sw("Item_Ghillie_")) inv.ghillie = 0;

  else if (sw("Item_Heal_") || sw("Item_Boost_")) {
    if (sw("Item_Heal_MedKit_"))                  inv.medKits     = 0;
    else if (sw("Item_Heal_FirstAid_"))           inv.firstAids   = 0;
    else if (sw("Item_Heal_Bandage_"))            inv.bandages    = 0;
    else if (sw("Item_Boost_AdrenalineSyringe_")) inv.adrenalines = 0;
    else if (sw("Item_Boost_EnergyDrink_"))       inv.energies    = 0;
    else if (sw("Item_Boost_PainKiller_"))        inv.painKillers = 0;
    else console.log("Unknown meds: " + itemName);
  }
}

function getMainWeaponID(name,onlyguns=true) {
  var cap = mainWepList.length-1;
  if (onlyguns) cap = mainWepCap;
  for (var i=0; i<cap; i++)
    if (name.startsWith(mainWepList[i]))
      return (i+1);
  return -1;
}

function getShitWeaponID(name) {
  for (var i=0; i<shitWepList.length; i++)
    if (name.startsWith(shitWepList[i]))
      return (i+1);
  return -1;
}

function analyseEquippedWeapons() {
  var mainsFound = [];

  // get a list of all the main weapons in the equipped list
  for (var i=0; i<listEquip.length; i++) {
    var equip = listEquip[i];
    if (equip && equip.name && equip.name.startsWith("Item_Weapon_")) {
      var itemID = getMainWeaponID(equip.name);
      if (itemID > 0) {
        // if (itemId >= mainWepCap) // HERE WE EXCLUDE MAIN WEAPONS
        for (var c=0; c<equip.count; c++) // if we're holding two of them, add it twice
          mainsFound.push(itemID);
      }
    }
  }

  // set up wepClose and wepRange based on these
  var inv = currentInventory;
  if (mainsFound.length===0)
    inv.wepClose = inv.wepRange = 0;
  else if (mainsFound.length===1) {
    inv.wepClose = mainsFound[0];
    inv.wepRange = 0;
  } else if (mainsFound.length >= 2) {
    var wepA = mainsFound[0];
    var wepB = mainsFound[1];
    inv.wepClose = Math.min(wepA, wepB);
    inv.wepRange = Math.max(wepA, wepB);
  }
}

// check at an interval if the inventory has updated.
// if so, send it to the server
var savedInventory = encodeGivenInventory(buildEmptyInventory());
var inventoryInterval = 0;
// start sending regular inventory updates
function startSendingInventory() {
  stopSendingInventory()
  inventoryInterval = setInterval(checkInventoryUpdates, 1500);
}
// stop sending regular inventory updates
function stopSendingInventory() {
  clearInterval(inventoryInterval);
}

// every now and then, do a full inventory scan, as the events sometimes fuck up.
var doFullInventoryScan = false;
setInterval(function() { doFullInventoryScan = true; }, getFullInvTime);

// send an inventory update, if it exists.
// if 'doFullInventoryScan', scan the inventory from scratch.
function checkInventoryUpdates() {
  if (doFullInventoryScan && getFullInv) {
    doFullInventoryScan = false;
    performFullInventoryScan();
  } else {
    // send any changes, if they have been detected
    var newInventory = encodeInventory();
    if (newInventory !== savedInventory) {
      sendInventory(newInventory);
    }
    savedInventory = newInventory; 
  }
}

// scan the entire inventory
function performFullInventoryScan() {
  console.log("Refreshing inventory from API.");
  overwolf.games.events.getInfo(function(data){
    if (data && data.res && data.res.inventory) {
      // clear the inventory
      clearInventory(false);

      // process the whole inventory
      processInventoryUpdate(data.res.inventory, true);

      // maybe send the new info
      checkInventoryUpdates();
    }
  });
}

// send the encoded inventory to the server
function sendInventory(inv) {
  updateBuffer.inv = inv;
}

// return an encoded version of the current inventory
function encodeInventory() {
  return encodeGivenInventory(currentInventory);
}

// encode a given inventory into a simple string
function encodeGivenInventory(inv) {
  var out = [];
  out = out.concat( [inv.helmet, inv.vest, inv.bag, inv.ghillie] ); // gear
  out = out.concat( [inv.wepClose, inv.wepRange] ); // main weapons
  out = out.concat( [inv.melee, inv.pistol, inv.belt] ); // secondary weapons
  out = out.concat( [inv.medKits, inv.firstAids, inv.bandages, inv.adrenalines, inv.painKillers, inv.energies ] ); // meds
  out = out.concat( [inv.frags, inv.mollies, inv.smokes, inv.flashes ] ); // throwables
  return out.join(",");
}

function ensureInvWeapon(wepid) {
  if (wepid >= mainWepCap) return; // not a main weapon
  // if (recentWeaponsHeld.length===1 && recentWeaponsHeld[0]===wepid) return; // only weapon // (redundant?)
  if (recentWeaponsHeld[0] === wepid) return; // same as most recent

  // note this is the most recent weapon held
  recentWeaponsHeld.unshift(wepid);

  // forget old weapons
  if (recentWeaponsHeld.length>2) recentWeaponsHeld.pop();

  // use this data to set the close and far weapons
  setMainWeaponsFromRecent();
}

function setMainWeaponsFromRecent() {
  if (recentWeaponsHeld.length===1) {
    currentInventory.wepClose = recentWeaponsHeld[0];
    currentInventory.wepRange = 0;
  } else {
    currentInventory.wepClose = Math.min(recentWeaponsHeld[0], recentWeaponsHeld[1]);
    currentInventory.wepRange = Math.max(recentWeaponsHeld[0], recentWeaponsHeld[1]);
  }
}

// process a roster update from the OW API
function processInventoryUpdate(info, fullScan = false) {
  for (key in info) {
    if (key.startsWith("inventory_")) {
      // the supplied infoupdate is about the INVENTORY item(s)

      // get the slot number for this update
      var invNum = getInventoryNum(key);

      // if we're not doing a full scan, mark this slot as trusted, as
      // it has been updated this game
      if (!fullScan) trustedInv[invNum] = true;

      // if we trust this slot....
      if (trustedInv[invNum] && invNum > -1) {
        var inv = JSON.parse(info[key]);

        // process the new stuff
        processInvChange(listInventory[invNum], inv, false);

        // save it for later, i guess
        listInventory[invNum] = inv;
      }
    } else if (key.startsWith("equipped_")) {
      // the supplied infoupdate is about the EQUIPPED item(s)

      // get the slot number for this update
      var equipNum = getEquippedNum(key);

      // if we're not doing a full scan, mark this slot as trusted, as
      // it has been updated this game
      if (!fullScan) trustedInv[equipNum] = true;

      // if we trust this slot...
      if (trustedInv[equipNum] && equipNum > -1) {
        var equip = JSON.parse(info[key]);

        // process the new stuff
        processInvChange(listEquip[equipNum], equip, true);

        // save it for later, i guess
        listEquip[equipNum] = equip;
      }
    }
  }
}

function printInvEquip() {
  console.log("EQUIPPED:");
  for (var i=0; i<listEquip.length; i++) {
    var equip = listEquip[i];
    if (equip && equip.name) {
      console.log("[%i] (%s) %s", i, equip.count, equip.name);
    } else {
      // console.log("[%i] ---", i);
    }
  }

  console.log("\nINVENTORY:");
  for (var i=0; i<listInventory.length; i++) {
    var inv = listInventory[i];
    if (inv && inv.name && !inv.name.startsWith("Item_Skin_")) {
      console.log("[%i] (%s) %s", i, listInventory[i].count, listInventory[i].name);    
    } else {
      // console.log("[%i] ---", i);
    }

  }
}

// given a "inventory_XX" string, get the int value of XX.
function getInventoryNum(key) {
  if (key && key.startsWith("inventory_")) {
    var n = parseInt(key.substring(10));
    if (typeof n === "number" && n!==NaN)
      return n;
  }
  return -1;
}

// given a "equipped_XX" string, get the int value of XX.
function getEquippedNum(key) {
  if (key && key.startsWith("equipped_")) {
    var n = parseInt(key.substring(9));
    if (typeof n === "number" && n!==NaN)
      return n;
  }
  return -1;
}

/*
 ########  ##          ###    ##    ## ######## ########      ######  ########    ###    ######## ######## 
 ##     ## ##         ## ##    ##  ##  ##       ##     ##    ##    ##    ##      ## ##      ##    ##       
 ##     ## ##        ##   ##    ####   ##       ##     ##    ##          ##     ##   ##     ##    ##       
 ########  ##       ##     ##    ##    ######   ########      ######     ##    ##     ##    ##    ######   
 ##        ##       #########    ##    ##       ##   ##            ##    ##    #########    ##    ##       
 ##        ##       ##     ##    ##    ##       ##    ##     ##    ##    ##    ##     ##    ##    ##       
 ##        ######## ##     ##    ##    ######## ##     ##     ######     ##    ##     ##    ##    ######## 
*/


// currently we do nothing with this information, but
// we have the option of using it however we want.

function processBodyPosition(info) {
  // do nothing
}

function processinVehicle(info) {
  // do nothing
}

function processAiming(info) {
  // do nothing
}

function processView(info) {
  // do nothing
}

function processFreeView(info) {
  // do nothing
}

function processMovement(info) {
  // do nothing
}

function processStance(info) {
  // do nothing
}


/*
 ########   #######   ######  ######## ######## ########  
 ##     ## ##     ## ##    ##    ##    ##       ##     ## 
 ##     ## ##     ## ##          ##    ##       ##     ## 
 ########  ##     ##  ######     ##    ######   ########  
 ##   ##   ##     ##       ##    ##    ##       ##   ##   
 ##    ##  ##     ## ##    ##    ##    ##       ##    ##  
 ##     ##  #######   ######     ##    ######## ##     ## 
*/

// process a roster update from the OWAPI
function processRosterUpdate(info) {
  // there may be a number of roster updates
  for (key in info) {

    // rosters should be under roster_XX, where XX is a number
    if (key.startsWith("roster_")) {
      // get the 'slot number' for this player
      var playerNum = getPlayerNum(key);

      // parse the player's info
      var player = JSON.parse(info[key]);

      // get the player's name
      var playerName = player.player;

      // update currentRoster and called rosterIn or rosterOut
      if (isBlank(playerName)) {
        currentRoster[playerNum] = undefined;
      } else {
        if (player.out) {
          currentRoster[playerNum] = undefined;
          rosterOut(playerName);
        } else {
          currentRoster[playerNum] = playerName;
          rosterIn(playerName);
        }
      }
    }
  }
}

function rosterIn(name) {
  // somebody joined the roster. if it's a team member,
  // mark them as alive.
  if (teamData[name]) {
    teamData[name].alive = true;
    delete teamData[name].deadX;
    delete teamData[name].deadY;
  }
}

function rosterOut(name) {
  // somebody left the roster. if it's a team member,
  // mark them as dead (and record where they died).
  if (teamData[name]) {
    console.log("rosterOut with "+name);
    teamData[name].alive = false;
    teamData[name].deadX = teamData[name].x;
    teamData[name].deadY = teamData[name].y;
  }
}

// if a player has moved more than this (taxicab) distance,
// after being marked dead, mark them as alive again.
var reviveDist = 10;
function checkDeadMovement(name) {
  if (teamData[name].alive===false && teamData[name].deadX && teamData[name].deadY) {
    var sqDiff = Math.abs(teamData[name].deadX - teamData[name].x)
               + Math.abs(teamData[name].deadY - teamData[name].y);
    if (sqDiff > reviveDist) {
      teamData[name].alive = true;
      delete teamData[name].deadX;
      delete teamData[name].deadY;
    }
  }
}

function notBlank(a) {
  if (a===undefined) return false;
  if (a===null) return false;
  if (a==="") return false;
  return true;
}

function isBlank(a) {
  if (a===undefined) return true;
  if (a===null) return true;
  if (a==="") return true;
  return false;
}

function isString(v) {
  return (typeof v === 'string' || v instanceof String);
}


function processWeaponState(wepState) {
  var newHeld = 0;

  if (isBlank(wepState)) return;
  wepState = JSON.parse(wepState);

  if (wepState.equipped==="true")
    newHeld = getShitWeaponID(wepState.name);

  if (newHeld === currentWpnHeld) return;
  currentWpnHeld = newHeld;

  if (currentWpnHeld > 0 && currentWpnHeld < mainWepCap) {
    ensureInvWeapon(currentWpnHeld);
  }

  updateBuffer.wpnheld = currentWpnHeld;
}

// send the entire roster to the server
function sendRoster() {
  jsonpkg = {
    "name": myName,
    "roster": getRosterString()
  };
  jQuery.post(APIPATH+"setroster.php", jsonpkg, function(r) {  }, 'json');
}

// send the "alive bits" if in the appropriate phase
function maybeSendAliveBits() {
  if (currentPhase === "landed") {
    updateBuffer.alives = getAliveBits();
  }
}

// set up a timer to send a roster update every 5 seconds.
// keep track of it so it can be cancelled later.
var rosterInterval = undefined;
function startSendingRoster() {
  stopSendingRoster();
  rosterInterval = setInterval(sendRoster, rosterTime);
}
function stopSendingRoster() {
  clearInterval(rosterInterval);
}

// turn the roster into a comma-separated string for the db
function getRosterString() {
  var out = "";
  for (var i=0; i<100; i++) {
    if (typeof currentRoster[i] === "string") {
      out = out + currentRoster[i] + ",";
    } else {
      out = out + ",";
    }
  }
  return out;
}

// get the "alive bits"; who in the roster is not yet "out".
function getAliveBits() {
  var out = "";
  for (var i=0; i<100; i++) {
    if (typeof currentRoster[i] === "string") {
      out = out + "1";
    } else {
      out = out + "0";
    }
  }
  return out;
}

// given a "roster_XX" string, get the int value of XX.
function getPlayerNum(key) {
  if (key && key.startsWith("roster_")) {
    var n = parseInt(key.substring(7));
    if (typeof n === "number")
      return n;
  }
  return -1;
}



/*
 ##        #######   ######     ###    ######## ####  #######  ##    ## 
 ##       ##     ## ##    ##   ## ##      ##     ##  ##     ## ###   ## 
 ##       ##     ## ##        ##   ##     ##     ##  ##     ## ####  ## 
 ##       ##     ## ##       ##     ##    ##     ##  ##     ## ## ## ## 
 ##       ##     ## ##       #########    ##     ##  ##     ## ##  #### 
 ##       ##     ## ##    ## ##     ##    ##     ##  ##     ## ##   ### 
 ########  #######   ######  ##     ##    ##    ####  #######  ##    ## 
*/

var locQueue = [];
var locQueueLength = 8;
// set the user's location. this is kind of the core of this app.
var lastLocationUpdate = new Date().getTime();
function setLocation(loc) {
  lastLocationUpdate = new Date().getTime();

  if (currentPhase === "aircraft") {
    // // if we are in the aircraft, remember the first and last locations.
    // // this gives us an estimate of the flight path.
    // if (plane.start === undefined){
    //   plane.start = loc;
    //   locQueue = [];
    //   locQueue.push(loc);
    // } else {
    //   plane.end = loc;
    //   locQueue.push(loc);
    //   if (locQueue.length===locQueueLength) {
    //     plane.start = locQueue.shift();
    //   }
    // }
    // updateFlightPath();
    notePlaneLocation(loc);
    maybeSendFlightPath();
  }

  if (myName==="") {
    // no point knowing a user's location if we don't know what user it is.
    console.log("Ignoring location update as the player name is not yet known.");
    return;
  }

  var locObj = JSON.parse(loc);
  var x = locObj.x;
  var y = locObj.y;

  updateBuffer.x = x;
  updateBuffer.y = y;

  sendNewInfo();
}

function ensureTeamMate(mateName) {
  if (mateName===myName) return;
  if (isBlank(teamData[mateName])) {
    teamData[mateName] = {
      name: mateName,
      x: 0,
      y: 0,
      alive: true
    };
  }
}

function unAssociate(assocArray) {
  var numArray = [];
  for (var item in assocArray) {
    numArray.push(assocArray[item]);
  }
  return numArray;
}

// this event should only be called if something has changed (according to the API)
function setTeamLocation(teamloc) {
  var teamLocations = JSON.parse(teamloc);

  // don't bother with my own location
  if (teamLocations[myName])
    delete teamLocations[myName];

  // add the locations to teamData
  for (var i=0; i<teamLocations.length; i++) {
    var mate = teamLocations[i];
    var mateName = mate.player;
    if (mateName!==myName) {
      ensureTeamMate(mateName);
      teamData[mateName].x = mate.location.x;
      teamData[mateName].y = mate.location.y;
      checkDeadMovement(mateName);
    }
  }

  // add this info to the update buffer
  updateBuffer.teamdata = JSON.stringify(unAssociate(teamData));
}



// function sendTeamData() {
//   jsonpkg = {
//     "name": myName,
//     "teamdata": JSON.stringify(unAssociate(teamData))
//   };
//   jQuery.post(APIPATH+"teamdata.php", jsonpkg, function(response) {  }, 'json');
// }


/*
 ######## ##       ####  ######   ##     ## ######## ########     ###    ######## ##     ## 
 ##       ##        ##  ##    ##  ##     ##    ##    ##     ##   ## ##      ##    ##     ## 
 ##       ##        ##  ##        ##     ##    ##    ##     ##  ##   ##     ##    ##     ## 
 ######   ##        ##  ##   #### #########    ##    ########  ##     ##    ##    ######### 
 ##       ##        ##  ##    ##  ##     ##    ##    ##        #########    ##    ##     ## 
 ##       ##        ##  ##    ##  ##     ##    ##    ##        ##     ##    ##    ##     ## 
 ##       ######## ####  ######   ##     ##    ##    ##        ##     ##    ##    ##     ## 
*/

// update the flight path, both here and on the server. since we don't have access to this data,
// we track player locations while they are in the plane and extrapolate that to the edges of
// the map.
// function updateFlightPath() {
//   if (plane.start && plane.end) {
//     flightPath = {start: plane.start, end:plane.end};
//     updateBuffer.flightpath = JSON.stringify(flightPath);
//   }
// }

function notePlaneLocation(loc) {
  if (isString(loc)) loc = JSON.parse(loc);
  addRegressionPoint(loc.x, loc.y);
}

function maybeSendFlightPath() {
  if (N > 2) {
    var fp = getRegressionPath();
    fp.start = JSON.stringify(fp.start);
    fp.end = JSON.stringify(fp.end);
    updateBuffer.flightpath = JSON.stringify(fp);
  }
}


var Fx  = 0;
var Fy  = 0;
var Sx  = 0;
var Sy  = 0;
var Sxx = 0;
var Sxy = 0;
var Syy = 0;
var N   = 0;

function resetPlanePos() {
  Fx = Fy = Sx = Sy = Sxx = Sxy = Syy = N = 0;
}

function addRegressionPoint(x, y) {
  N   += 1;
  Sx  += x;
  Sy  += y;
  Sxx += x*x;
  Sxy += x*y;
  Syy += y*y;
  if (x!==0 && y!==0 && Fx===0 && Fy===0) {
    Fx = x;
    Fy = y;
  }
}

function getRegressionPath() {
  var Cx = Sx/N;
  var Cy = Sy/N;

  var Txy = Sxy - ( Sx * Sy / N );
  var Txx = Sxx - ( Sx * Sx / N );
  // var Tyy = Syy - ( Sy * Sy / N ); // not used

  var beta = Txy / Txx;

  var start = {
    x: Fx,
    y: Fy
  }

  if (Math.abs(beta) < 1) {
    var Dx = start.x - Cx;
    start.y = Cy + beta*Dx;
  } else {
    var Dy = start.y - Cy;
    start.x = Cx + Dy/beta;
  }

  start.x = Math.round(start.x);
  start.y = Math.round(start.y);
  
  var end = {
    x: Math.round(Cx),
    y: Math.round(Cy)
  }
  
  // console.log("--------");
  // console.log(start);
  // console.log(beta);
  // console.log(end);

  return {start: start, end: end};
}




/*
 ########  #######  ##    ## ########  ######  
      ##  ##     ## ###   ## ##       ##    ## 
     ##   ##     ## ####  ## ##       ##       
    ##    ##     ## ## ## ## ######    ######  
   ##     ##     ## ##  #### ##             ## 
  ##      ##     ## ##   ### ##       ##    ## 
 ########  #######  ##    ## ########  ######  
*/


// update safe ("white") zone
function setWhiteZone(safe_zone_info) {
  currentWhiteZone = safe_zone_info;
  updateBuffer.white = currentWhiteZone;
}

// update blue zone
function setBlueZone(blue_zone_info) {
  currentBlueZone = blue_zone_info;
  updateBuffer.blue = currentBlueZone;
}

// update red zone
var redzone_time = 60000;
function setRedZone(red_zone_info) {
  currentRedZone = red_zone_info;
  updateBuffer.red = currentRedZone;

  setTimeout(clearRedZone, redzone_time);
}

// clear red zone
function clearRedZone() {
  currentRedZone = undefined;
  updateBuffer.red = null;
}

// update time to next circle (send pretty much raw data)
function updateTTNS(info) {
  info = JSON.parse(info);
  if (info.phase && info.time) {
    updateBuffer.circlephase = info.phase;
    updateBuffer.circletimer = info.time;
  }
}





/*
 ##     ##    ###    ########  
 ###   ###   ## ##   ##     ## 
 #### ####  ##   ##  ##     ## 
 ## ### ## ##     ## ########  
 ##     ## ######### ##        
 ##     ## ##     ## ##        
 ##     ## ##     ## ##        
*/

// update the map, both here and on the server
function setMap(mapname) {
  currentMap = mapname;
  console.log("The current map is " + currentMap);

  updateBuffer.map = currentMap;

  // jsonpkg = {
  //   "name": myName,
  //   "map": currentMap
  // };
  // jQuery.post(APIPATH+"setmap.php", jsonpkg, function(r) {  }, 'json');
}

// turn the API's map names into the more commonly understood map names
function getMapName(simpleMapName) {
  if (simpleMapName === "Savage_Main") return "sanhok";
  if (simpleMapName === "Erangel_Main") return "erangel";
  if (simpleMapName === "Baltic_Main") return "erangel";
  if (simpleMapName === "Desert_Main") return "miramar";
  if (simpleMapName === "DihorOtok_Main") return "vikendi";
  if (simpleMapName === "Range_Main") return "jackal";
  console.log("Unknown map name: " + simpleMapName);
  return "unknown";
}





/*
 ##     ##  #######  ########  ######## 
 ###   ### ##     ## ##     ## ##       
 #### #### ##     ## ##     ## ##       
 ## ### ## ##     ## ##     ## ######   
 ##     ## ##     ## ##     ## ##       
 ##     ## ##     ## ##     ## ##       
 ##     ##  #######  ########  ######## 
*/


// update the mode (solo/duo/squad)
function setMode(mode) {
  currentMode = mode;
  updateBuffer.mode = currentMode;
  // jsonpkg = {
  //   "name": myName,
  //   "mode": currentMode
  // };
  // jQuery.post(APIPATH+"setmode.php", jsonpkg, function(r) {  }, 'json');
}

// manually request the "mode".
function attemptModeFetch() {
  overwolf.games.events.getInfo(function(data){
    if (data && data.res && data.res.match_info && data.res.match_info.mode) {
      setMode(data.res.match_info.mode);
    }
  });
}



/*
 ######## ########    ###    ##     ## 
    ##    ##         ## ##   ###   ### 
    ##    ##        ##   ##  #### #### 
    ##    ######   ##     ## ## ### ## 
    ##    ##       ######### ##     ## 
    ##    ##       ##     ## ##     ## 
    ##    ######## ##     ## ##     ## 
*/

// update the list of squadmates
function setTeam(squadmates) {
  if (myName === "") {
    // for the first game, this is given before the player's name is known.
    // we can't record this against a user if we don't know which user "we" are.
    console.log("Ignoring squad update as the player name is not yet known.");
    return;
  }

  teamMembers = [];
  teamData = [];
  for (i=0; i<squadmates.length; i++) {
    var TMname = squadmates[i];
    if (TMname !== myName) {
      teamMembers.push(TMname);
      ensureTeamMate(TMname);
    }
  }
  console.log("The player's team is: " + JSON.stringify(teamMembers));

  updateBuffer.mates = JSON.stringify(teamMembers);
}


/*
 ##       #### ##     ## ########     ######  ########    ###    ########  ######  
 ##        ##  ##     ## ##          ##    ##    ##      ## ##      ##    ##    ## 
 ##        ##  ##     ## ##          ##          ##     ##   ##     ##    ##       
 ##        ##  ##     ## ######       ######     ##    ##     ##    ##     ######  
 ##        ##   ##   ##  ##                ##    ##    #########    ##          ## 
 ##        ##    ## ##   ##          ##    ##    ##    ##     ##    ##    ##    ## 
 ######## ####    ###    ########     ######     ##    ##     ##    ##     ######  
*/


// update live "damage dealt" stats
function setTotalDamageDealt(damagedealt) {
  currentDamageDealt = damagedealt;
  // we don't send this info any more, as it gives an unfair advantage
  // updateBuffer.damagedealt = currentDamageDealt;
}

// update live "kills" stats
function setKills(kills) {
  currentKills = kills;
  updateBuffer.kills = currentKills;
}

// update live "headshots" stats
function setHeadshots(headshots) {
  currentHeadshots = headshots;
  updateBuffer.headshots = currentHeadshots;
}

function setLatency(lat) {
  lat = parseInt(lat);
  if (lat === currentLatency) return;
  currentLatency = lat;
  updateBuffer.latency = lat;
}

// update live "max kill distance" stats
function setMaxKillDistance(maxkilldist) {
  currentMaxKillDistance = maxkilldist;
  updateBuffer.maxkilldist = currentMaxKillDistance;
}

function noteKnock() {
  console.log("knock registered");
  currentKnocks = currentKnocks + 1;
  updateBuffer.knocks = currentKnocks;
}

function noteDown() {
  console.log("down registered");
  currentDowns = currentDowns + 1;
  updateBuffer.downs = currentDowns;
}






/*
 ##    ##    ###    ##     ## ######## 
 ###   ##   ## ##   ###   ### ##       
 ####  ##  ##   ##  #### #### ##       
 ## ## ## ##     ## ## ### ## ######   
 ##  #### ######### ##     ## ##       
 ##   ### ##     ## ##     ## ##       
 ##    ## ##     ## ##     ## ######## 
*/

// set the user's name, here and on the server
function setName(name) {
  // if we already knew the name, do nothing.
  if (name===myName) return;

  // save the name to local variable and localStorage
  myName = name;
  localStorage.setItem(localStorageNameKey, name);

  console.log("The player's name is '" + name + "'");

  // make sure the server's database has the required rows for this player ready.
  jQuery.post(APIPATH+"readyplayer.php", {name: myName}, function(r) { }, 'json')
  .always(function(){
    // if we just got the name for the first time, send ALL known info about the player.
    // this is mostly for the "first game" scenario.
    sendAllInfo();
  });
}

// try to fetch the player's name, do nothing if you fail.
// this is asynchronous, so we can't return anything because we don't
// know if it will work or not.
function attemptNameFetch() {
  overwolf.games.events.getInfo(function(data){
    if (data && data.res && data.res.me && data.res.me.name) {
      setName(data.res.me.name);
    }
  });
}

// get the user's name, from localStorage or variable or from the OWAPI.
function getName() {
  if (myName === "") {
    // check localStorage first
    if (localStorage.getItem(localStorageNameKey) === null) {
      // try the OWAPI if this doesn't work
      attemptNameFetch();
      return ""; // maybe we can fetch it async, but for now we don't know it.
    } else {
      // if we know it from previous games, return it now.
      myName = localStorage.getItem(localStorageNameKey);
      return myName;
    }
  } else {
    // if we know the name, it's probably in localstorage already,
    // but check to be sure.
    if (localStorage.getItem(localStorageNameKey) !== myName) {
      localStorage.setItem(localStorageNameKey, myName);
    }
  }
  return myName;
}

var waitForName = function() {
  if (myName!=="") {
    haveName();
  } else {
    setTimeout(waitForName, 1000);
  }
}

function haveName() {
  console.log("starting regular update process...");
  restartNewInfoInterval();
}

getName();
waitForName();







/*
  #######  ##     ## ######## ########  ##      ##  #######  ##       ######## 
 ##     ## ##     ## ##       ##     ## ##  ##  ## ##     ## ##       ##       
 ##     ## ##     ## ##       ##     ## ##  ##  ## ##     ## ##       ##       
 ##     ## ##     ## ######   ########  ##  ##  ## ##     ## ##       ######   
 ##     ##  ##   ##  ##       ##   ##   ##  ##  ## ##     ## ##       ##       
 ##     ##   ## ##   ##       ##    ##  ##  ##  ## ##     ## ##       ##       
  #######     ###    ######## ##     ##  ###  ###   #######  ######## ##       
*/

var myInventory = {};

function processInfo(info) {
  if (!info || !info.feature) return; // being safe

  if (info.feature === "location" && info.info && info.info.game_info && info.info.game_info.location) {
    // player's live location
    setLocation(info.info.game_info.location);
  } else if (info.feature === "location" && info.info && info.info.game_info && info.info.game_info.team_location) {
    // teammates' live location
    setTeamLocation(info.info.game_info.team_location);
  } else if (info.feature === "location" && info.info && info.info.game_info && (info.info.game_info.safe_zone || info.info.game_info.blue_zone || info.info.game_info.red_zone)) {
    // zone info
    if (info.info.game_info.safe_zone)  setWhiteZone(info.info.game_info.safe_zone);
    if (info.info.game_info.blue_zone)  setBlueZone( info.info.game_info.blue_zone);
    if (info.info.game_info.red_zone )  setRedZone(  info.info.game_info.red_zone );
  } else if(info.feature === "team" && info.info && info.info.match_info && info.info.match_info.nicknames) {
    // names of the player's teammates.
    team = JSON.parse(info.info.match_info.nicknames);
    setTeam(team.team_members);
  } else if(info.feature === "phase" && info.info && info.info.game_info && info.info.game_info.phase) {
    // phase (not circle phase - lobby/loading_screen/airfield/aircraft/freefall)
    setPhase(info.info.game_info.phase);
  } else if(info.feature === "match") {
    // this has more info, but we are current just using "mode"
    if (info.info && info.info.match_info && info.info.match_info.mode) {
      setMode(info.info.match_info.mode);
    } else {
      overwolf_debug && console.log("Unused match info: ", info);
    }
  } else if(info.feature === "map" && info.info && info.info.match_info && info.info.match_info.map) {
    // current map (this isn't re-sent if its the same map as last match)
    setMap(getMapName(info.info.match_info.map));
  } else if(info.feature === "roster" && info.info && info.info.match_info) {
    // roster update. this could be new players (start of game) or
    // players dying or leaving the game
    processRosterUpdate(info.info.match_info);
    maybeSendAliveBits();
  } else if(info.feature === "me") {
      // name update
      if (info && info.info && info.info.me && info.info.me.name) {
        setName(info.info.me.name);
      }
      // weapon state
      if (info.info && info.info.inventory && info.info.inventory.weaponState) {
        processWeaponState(info.info.inventory.weaponState);
      } else if (info && info.info && info.info.inventory) {
        processInventoryUpdate(info.info.inventory);
      } else if (info.info && info.info.me && info.info.me.bodyPosition!==undefined) {
        processBodyPosition(info.info.me.bodyPosition);
      } else if (info.info && info.info.me && info.info.me.inVehicle!==undefined) {
        processinVehicle(info.info.me.inVehicle);
      } else if (info.info && info.info.me && info.info.me.aiming!==undefined) {
        processAiming(info.info.me.aiming);
      } else if (info.info && info.info.me && info.info.me.view!==undefined) {
        processView(info.info.me.view);
      } else if (info.info && info.info.me && info.info.me.freeView!==undefined) {
        processFreeView(info.info.me.freeView);
      } else if (info.info && info.info.me && info.info.me.movement!==undefined) {
        processMovement(info.info.me.movement);
      } else if (info.info && info.info.me && info.info.me.stance!==undefined) {
        processStance(info.info.me.stance);
      } else {
        // console.log("other 'me' event");
        // console.log(info);
      }
  } else if(info.feature === "kill" && info.info && info.info.match_info) {
    // live stats about the player's performance.
    if (info.info.match_info.total_damage_dealt) {
      // total damage dealt (so far, and not just to enemies)
      setTotalDamageDealt(info.info.match_info.total_damage_dealt);
    }
    if (info.info.match_info.kills) {
      // total kills so far
      setKills(info.info.match_info.kills);
    }
    if (info.info.match_info.headshots) {
      // total headshots so far
      setHeadshots(info.info.match_info.headshots);
    }
    if (info.info.match_info.max_kill_distance) {
      // distance of farthest kill so far
      setMaxKillDistance(info.info.match_info.max_kill_distance);
    }
  } else if (info.feature === "counters") {
    console.log(info);
  } else {
    // any other update is logged to the console (so i know what i'm not using yet)
    overwolf_debug && console.log("Other Info Update: " + JSON.stringify(info));
  }
}

function processEvent(info) {
  if (info && info.events && info.events.length) {
    for (var i=0; i<info.events.length; i++) {
      var event = info.events[i];
      if (event.name === "death") {
        setPhase("dead");
      } else if (event.name === "ping") {
        setLatency(event.data);
      } else if (event.name === "knockout") {
        noteKnock();
      } else if (event.name === "knockedout") {
        noteDown();
      } else if (event.name === "time_to_next_circle") {
        updateTTNS(event.data);
        // console.log("TTNS:");
        // console.log(event);
      } else {
        // console.log("other event");
        // console.log(event);
      }
    }
  }
  overwolf_debug && console.log("EVENT FIRED: " + JSON.stringify(info));
}


//register event listeners for all the events we are interested in.
var registered = false;
function registerEvents() {
  // making sure this function only runs once
  if (registered) return "Doing nothing, as registerEvents has already been called.";
  registered = true;

  // just another early check to see if we have the player's name yet.
  getName();

  // general events errors. just print them to console.
  overwolf.games.events.onError.addListener(function(info) {
    console.log("Overwolf events error: " + JSON.stringify(info));
  });

  // "game info updates" data changed
  overwolf.games.events.onInfoUpdates2.addListener(processInfo);

  // log all events to console. not currently using these.
  overwolf.games.events.onNewEvents.addListener(processEvent);
}

// boilerplate from the template. checks if game has been launched.
function gameLaunched(gameInfoResult) {
  if (!gameInfoResult) return false;
  if (!gameInfoResult.gameInfo) return false;
  if (!gameInfoResult.runningChanged && !gameInfoResult.gameChanged) return false;
  if (!gameInfoResult.gameInfo.isRunning) return false;
  if (Math.floor(gameInfoResult.gameInfo.id/10) != 10906) return false; // checks it's PUBG
  overwolf_debug && console.log("PUBG launched.");
  return true;
}

// boilerplate from the template. checks if game is running.
function gameRunning(gameInfo) {
  if (!gameInfo) return false;
  if (!gameInfo.isRunning) return false;
  if (Math.floor(gameInfo.id/10) != 10906) return false; // checks it's PUBG
  overwolf_debug && console.log("PUBG running.");
  return true;
}

// set the required features from the API. I don't currently use all of the
// available features.
function setFeatures() {
  var g_interestedInFeatures = [
    'me',       // INFO: name, stance, speed, vehicle.
                // EVENTS: jump
    'location', // INFO: user's x/y/z every second.
    'phase',    // INFO: lobby, loading screen, airfield, aircraft, freefly, landed
    'map',      // INFO: the map you are on (no event when starting a new game with the same map as the last one)
    'team',     // INFO: other players in the squad.
    'kill',     // INFO: kills, headshots, damage dealt, max kill dist.
                // EVENTS: got knocked out, etc.
    'match',    // INFO: solo/duo/squads. EVENTS: match started, match ended, match summary is being shown.
    'roster',    // INFO: the players in the match. updates whey they are 'out'. Not certain if it knows when they die and are spectating.
    'inventory',
    'death',
    'counters'
  ];
  overwolf.games.events.setRequiredFeatures(g_interestedInFeatures, function(info) {
    if (info.status === "error") {
      console.log("Could not set required features: " + info.reason);
      console.log("Trying in 2 seconds");
      window.setTimeout(setFeatures, 2000);
      return;
    }
    console.log("Successfully set required features.");
    overwolf_debug && console.log(JSON.stringify(info));
  });
}


// more kinda boilerplate about the state of the game (if alt tabbed etc)
// could use this to know if teammates are alt tabbed. invasion of privacy tho?
overwolf.games.onGameInfoUpdated.addListener(function (res) {
  if (gameLaunched(res)) {
    registerEvents();
    setTimeout(setFeatures, 1000);
  }
  overwolf_debug && console.log("onGameInfoUpdated: " + JSON.stringify(res));
});
overwolf.games.getRunningGameInfo(function (res) {
  if (gameRunning(res)) {
    registerEvents();
    setTimeout(setFeatures, 1000);
  }
  overwolf_debug && console.log("getRunningGameInfo: " + JSON.stringify(res));
});