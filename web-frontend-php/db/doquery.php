<html>
  <head></head>
  <body>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
    <script type="text/javascript">
      function doPost() {
        jsonpkg = {
          name: "MrWraith",
          flightpath: {
            start: {x: 0, y: 2551},
            end: {x: 4000, y:691}
          }
        };
        jQuery.post("http://pubg.buck.ly/api/setfpath.php", jsonpkg, function(r){});
        // jQuery.post("http://pubg.buck.ly/api/loc.php", "name=MrWraith&location="+encodeURIComponent(JSON.stringify({x:100,y:112})));
      }
    </script>
    <button onclick="javascript:doPost();">Send</button>
  </body>
</html>