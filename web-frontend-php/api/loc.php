<?php
  require "common.php";
  writePlayerInfo(array('x' => 'x', 'y' => 'y', 'teamdata' => 'teamdata'));

  // function writeLoc($name, $x, $y) {
  //   $db = dbConnect();
  //   $q=$db->prepare("
  //     UPDATE tblLocs
  //     SET x = ?, y = ?, upd = datetime('now')
  //     WHERE name = ?
  //   ;");
  //   $q->execute(array($x, $y, $name));
  //   $db = null;
  // }

  // function processData() {
  //   $data = $_REQUEST;
  //   if (!isset($data['name'])) return false;
  //   if (!isset($data['location'])) return false;
  //   $name = $data['name'];
  //   $location = json_decode($data['location'], true);
  //   if ($location) {
  //     writeLoc($name, $location['x'], $location['y']);
  //   } else {
  //     error_log(print_r($data['location'], true));
  //   }
  //   return true;
  // }

  // processData();
?>