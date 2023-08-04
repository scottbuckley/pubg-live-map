<?php
  require "common.php";

  function readyPlayerInDB($name) {
    $db = dbConnect();
    $q=$db->prepare('
      INSERT OR IGNORE INTO tblLocs
      (name, x, y)
      VALUES (?, -100, -100)
    ;');
    $q->execute(array($name));
    $q=$db->prepare('
      INSERT OR IGNORE INTO tblPlayerInfo
      (name, map, phase)
      VALUES (?, "unknown", "lobby")
    ;');
    $q->execute(array($name));
    $db = null;
  }

  function processData() {
    $data = $_REQUEST;
    ensureNamePresent();
    $name = $data['name'];
    readyPlayerInDB($name);
  }

  processData();
?>