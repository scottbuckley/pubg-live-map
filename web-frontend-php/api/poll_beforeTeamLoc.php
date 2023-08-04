<?php
  require "common.php";

  function getTeammates($name) {
    $db = dbConnect();
    $q=$db->prepare("
      SELECT teammate FROM tblSquads WHERE name = ?
    ;");
    $q->execute(array($name));
    $res = $q->fetchAll(PDO::FETCH_COLUMN);
    $db = null;
    return $res;
  }

  function getSquadInfo($name) {
    $db = dbConnect();
    $q=$db->prepare("
      SELECT teammate, x, y, kills, headshots, damagedealt, maxkilldist, inv, phase
      FROM tblSquads
      INNER JOIN tblPlayerInfo ON tblSquads.teammate = tblPlayerInfo.name
      WHERE tblSquads.name = ? AND tblPlayerInfo.upd BETWEEN datetime('now', '-10 minutes') AND datetime('now', '+1 year')
    ;");
    $q->execute(array($name));
    $res = $q->fetchAll(PDO::FETCH_ASSOC);
    $db = null;
    return $res;
  }

  function getMyInfo($name) {
    $db = dbConnect();
    $q=$db->prepare("
      SELECT x, y, map, phase, mode, flightpath, kills, headshots, damagedealt, maxkilldist, alives, inv, white, blue, red
      FROM tblPlayerInfo
      WHERE name = ?
    ;");
    $q->execute(array($name));
    $res = $q->fetch(PDO::FETCH_ASSOC);
    $res["flightpath"] = json_decode($res["flightpath"]);
    $db = null;
    return $res;
  }

  function getDeadInfo($name) {
    $db = dbConnect();
    $q=$db->prepare("
      SELECT alives, white, blue, red, upd
      FROM tblSquads
      INNER JOIN tblPlayerInfo ON (tblSquads.teammate = tblPlayerInfo.name)
      WHERE tblSquads.name = ? AND tblPlayerInfo.phase='landed'
      ORDER BY upd DESC
    ;");
    $q->execute(array($name));
    $res = $q->fetchAll(PDO::FETCH_ASSOC);
    $db = null;
    return $res;
  }

  function dbGetPlayerInfo($name) {
    $db = dbConnect();
    $q=$db->prepare('
      SELECT map, phase, flightpath, kills, damagedealt, headshots, maxkilldist, inv
      FROM tblPlayerInfo
      WHERE name = ?
    ;');
    $q->execute(array($name));
    $res = $q->fetch(PDO::FETCH_ASSOC);
    $res["flightpath"] = json_decode($res["flightpath"]);
    $db = null;
    return $res;
  }

  function buildResponse($name) {
    $myInfo = getMyInfo($name);
    $squadInfo = getSquadInfo($name);
    $teammates = getTeammates($name);
    if ($myInfo['phase']=='dead') {
      $deadInfo = getDeadInfo($name);
      if (count($deadInfo)>0) {
        $myInfo['alives'] = $deadInfo[0]['alives'];
        $myInfo['white'] = $deadInfo[0]['white'];
        $myInfo['blue'] = $deadInfo[0]['blue'];
        $myInfo['red'] = $deadInfo[0]['red'];
      }
    }
    $payload = array_merge(array("me"=>$myInfo),array("squad"=>$teammates),array("squadinfo"=>$squadInfo));
    echo json_encode($payload);
  }

  header('Content-Type: application/json');
  ensureNamePresent();
  $name = $_REQUEST['name'];
  buildResponse($name);

?>