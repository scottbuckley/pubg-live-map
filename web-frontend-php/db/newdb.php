<?php
  define('DB_PATH', $_SERVER['DOCUMENT_ROOT'] . '/db.db');

  function dbConnect() {
    static $db;
    if (isset($db)) {
        return $db;
    } else {
      if ($db = new PDO('sqlite:'.DB_PATH)) {
          return $db;
      } else {
          die('DBACCESSERROR');
      }
    }
  }

  function dbCreateTables() {
    $db = dbConnect();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $q = $db->prepare('
        CREATE TABLE IF NOT EXISTS tblLocs (
            name             STRING PRIMARY KEY,
            x                INTEGER NOT NULL,
            y                INTEGER NOT NULL,
            upd              DATETIME
        );');
    $q->execute();
    $q = $db->prepare('
      CREATE TABLE IF NOT EXISTS tblPlayerInfo (
          name             STRING PRIMARY KEY,
          map              STRING,
          phase            STRING,
          flightpath       STRING,
          totaldamage      INTEGER DEFAULT 0,
          kills            INTEGER DEFAULT 0,
          headshots        INTEGER DEFAULT 0,
          maxkilldist      INTEGER DEFAULT 0,
      );');
    $q->execute();
    $q = $db->prepare('
      CREATE TABLE IF NOT EXISTS tblSquads (
          name             STRING,
          teammate         STRING
      );');
    $q->execute();
    $q = $db->prepare('
      CREATE TABLE IF NOT EXISTS tblStateChange (
          name                STRING PRIMARY KEY,
          statenum            INTEGER
      );');
    $q->execute();
    $db = null;
  }


  function dbConnectSQLite3() {
    if ($db = new SQLite3("pubgloc.db")) {
        return $db;
    } else {
        die('DBACCESSERROR');
    }
  }


  function dbCreateTablesSQLite3() {
    $db = dbConnectSQLite3();
    $db->exec('
      CREATE TABLE IF NOT EXISTS tblLocs (
          name             STRING PRIMARY KEY,
          x                INTEGER NOT NULL,
          y                INTEGER NOT NULL
      );');
    $db->exec('
      CREATE TABLE IF NOT EXISTS tblPlayerInfo (
          name             STRING PRIMARY KEY,
          team             STRING,
          map              STRING,
          gamestate        STRING
      );');
    $db->close();
  }

  dbCreateTables();

?>