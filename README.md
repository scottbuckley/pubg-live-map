# PUBG-LiveMap

## Web frontend (PHP)
in `/db/`, there is `newdb.php`, which sets up the SQLite database tables. This needs to be run once.

in `/maps/`, there are the high resolution maps, plus a script `getmap.php` which takes a map name and a size and does a resample to the appropriate size, and caches the result in the subfolder `resized`.

in `/api/` are the most important scripts.

- `poll.php` is where the web frontend polls. this always returns all known player locations (always the current user, plus the teammates if they are known). It also receives a state number. The state number is incremented whenever non-location information for a user is changed in the database. When this is out of date, `poll.php` also returns extra player information and a new state number. For now that extra information is just map and phase.

- `readyplayer.php` ensures that the appropriate rows exist in all tables for a user. this is called from the OW app when the player's name is retrieved. This only needs to happen once, but may happen every time the user opens the app, which is fine.

- `loc.php` is called from the OW app to update the player's location (a request is sent with every location update, about once per second).

- `setmap.php` is called from the OW app, and sets the player's map.

- `setphase.php` is called from the OW app, and sets the player's phase.

- `setdamagedealt.php`, `setheadshots.php`, `setkills.php`, `setmaxkilldist.php`, all update the record of the user's current statistics during the game.

- `setfpath.php` sets the flight path. this is the first and last known locations while the user was in the aircraft (line will be extrapolated to map edges).

- `team.php` is called from the OW app, and sets the player's teammates.

the frontend file is `/index.php`. This contains mostly a canvas.

- the player to view is indicated in the url. For example you can go to `www.pubg.whatever.com/?PlayerOne` to view the live map for `PlayerOne`.

- an off-screen image holds the current map. this is retrieved from `getmap.php`. This is changed every time we get a map change update, and will redraw to the canvas on new location updates.

- a dual-timer system polls `poll.php` at most once per second. If the response takes more than a second to retrieve, it polls again immediately. Otherwise, it waits until one second has elapsed before sending another poll.

- the poll response always contains an array of usernames and locations (according to the known squadmates, if their locations are known). The map is redrawn and circles indicate player positions. 'your' player is yellow and your teammates are orange.

- the current phase is shown next to the map (for now).