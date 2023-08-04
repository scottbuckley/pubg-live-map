<?php
  // get map and size
  $mapname = $_REQUEST['map'];
  $size    = $_REQUEST['size'];

  // make sure we aren't trying to overscale the image
  $size = intval($size);
  if ($size > 4096) $size = 4096;

  $resizedpath = "resized/$mapname$size.jpg";

  //check if it already exists
  if (file_exists($resizedpath)) {
    // header("Location: $resizedpath");
    // header('Content-Type: image/jpeg');
    // fpassthru(fopen($resizedpath, 'rb'));
    // exit;
  } else {
    //load high res image
    $oldimage = imagecreatefromjpeg("$mapname.jpg");
    $oldwidth  = imagesx($oldimage);
    $oldheight = imagesy($oldimage);

    //resample
    $newimage = $oldimage;
    $newimage = imagecreatetruecolor($size, $size);
    imagecopyresampled($newimage, $oldimage, 0, 0, 0, 0, $size, $size, $oldwidth, $oldheight);

    //save new sized image
    imagejpeg($newimage, $resizedpath, 95);

    //output new image
    // header('Content-Type: image/jpeg');
    // imagejpeg($newimage, null, 95);
    // exit;
  }
  header("Location: $resizedpath");
  exit;
?>