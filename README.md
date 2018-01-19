# disc-ddc
Manage DDC results and rankings

Warning: All this is in development. I haven't written a build script or packaged anything, so this is just a file dump.

The directories `css` and `js` are self-explanatory. The directory `data` has a PHP script I use to perform database
operations. The database is Mysql, and the structure is available as SQL.

I don't imagine anyone will try to repro the DDC results website, but if you do, here are very high-level instructions:

1. Get access to a Mysql database, a webserver, and Node.
2. Create a DDC database using the SQL in `cdamon-ddc.sql`. You'll need to change the connection settings on both the client side
(URL in `data/ddc.php`) and the server side (in `node/rankings.js`).
3. Add results to the database. You can use the web form or write a server-side script if you already have results in some form.
4. Run `node calculate_rankings.js all` to generate rankings based on all results. Omit `all` to generate current rankings.
