<?php
  require "common.php";

  // get name
  ensureNamePresent();
  $name = $_REQUEST['name'];

  // write data
  $db = dbConnect();
  $qstring = "UPDATE tblPlayerInfo SET red = NULL where name = ? ;";
  $q=$db->prepare($qstring);
  $q->execute(array($name));
  $db = null;
?>