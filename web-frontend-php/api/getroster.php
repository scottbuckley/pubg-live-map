<?php
  require "common.php";

  function buildResponse() {
    ensureNamePresent();
    $roster = getPlayerInfo(array('roster'));
    echo json_encode($roster);
  }

  header('Content-Type: application/json');
  buildResponse();

?>