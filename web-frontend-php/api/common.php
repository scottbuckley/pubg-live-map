<?php
    header("Access-Control-Allow-Origin: *");
    define('DB_PATH', $_SERVER['DOCUMENT_ROOT'] . '/db.db');

    function dbConnect() {
      static $db;
      if (isset($db)) {
          return $db;
      } else {
        if ($db = new PDO('sqlite:'.DB_PATH)) {
          $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
          return $db;
        } else {
            die('DBACCESSERROR');
        }
      }
    }

    function ensureNamePresent() {
      if (!isset($_REQUEST['name'])) exit("'name' field not given. cannot proceed.");
    }

    function ensureFieldsPresent($keys) {
      $data = $_REQUEST;

      // always check for 'name'
      ensureNamePresent();

      // check each item in the provided array
      foreach ($keys as $key) {
        if (!isset($data[$key])) exit("'$key' field not given. cannot proceed.");
      }      
    }

    function writeSingleField($fieldname) {
      writePlayerInfo(array($fieldname => $fieldname));
    }

    function writePlayerInfo($fields) {
      $data = $_REQUEST;

      // check all data is available
      ensureFieldsPresent(array_keys($fields));

      // get the data ready
      $dbData = array();
      foreach ($fields as $URIfield => $DBfield)
        $dbData[$DBfield] = $data[$URIfield];
      // write to the database
      writeFromArray($data['name'], $dbData);
    }

    function writeFromArray($name, $dbData) {
      // prepare sql string
      $qstring = "UPDATE tblPlayerInfo SET ";
      $start = true;
      $values = array();
      foreach ($dbData as $fieldname => $value) {
        if ($start==false) $qstring .= ", "; // comma separate
        $qstring .= "$fieldname = ?"; // add field
        array_push($values, $value); // record value
        $start = false;
      }
      $qstring .= " WHERE name = ? ;";
      array_push($values, $name); // record value

      // perform sql action
      $db = dbConnect();
      $q=$db->prepare($qstring);
      $q->execute($values);
      $db = null;
    }

    function getPlayerInfo($fields) {
      ensureNamePresent();
      $name = $_REQUEST['name'];

      $fields_string = join(", ", $fields);

      $db = dbConnect();
      $q=$db->prepare("
        SELECT $fields_string
        FROM tblPlayerInfo
        WHERE name = ?
      ;");
      $q->execute(array($name));
      $res = $q->fetch(PDO::FETCH_ASSOC);
      $db = null;
      return $res;
    }


?>