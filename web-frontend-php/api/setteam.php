<?php
  require "common.php";

  function writeTeam($name, $mates) {
    $db = dbConnect();
    $q=$db->prepare('
      DELETE FROM tblSquads
      WHERE name = ?
    ;');
    $q->execute(array($name));
    
    foreach ($mates as $mate) {
      $q=$db->prepare('
        INSERT INTO tblSquads
        (name, teammate)
        VALUES (?, ?)
      ;');
      $q->execute(array($name, $mate));
    }

    $db = null;
  }

  function processData() {
    $data = $_REQUEST;
    ensureNamePresent();

    $name = $data['name'];
    if (!isset($data['mates'])) {
      writeTeam($name, array()); // this is fine. just make the team empty.
    } else {
      $mates = $data['mates'];
      writeTeam($name, $mates);
    }
  }

  processData();
?>