<?php
  require "common.php";

  ensureNamePresent();

  writeFromArray($_REQUEST['name'], array(
    'kills'       => 0,
    'headshots'   => 0,
    'damagedealt' => 0,
    'maxkilldist' => 0,
    'flightpath'  => '',
    'roster'      => '',
    'alives'      => '',
    'inv'         => '0,0,0,0,0,0,0,0,0,0,0',
    'red'         => '',
    'white'       => '',
    'blue'        => '',
    'teamloc'     => ''
  ));

?>