<?php
#-----------------------------------------------------------------------------#
# File: export.php
# Author: Conrad Damon
# Date: 04/04/2017
#
# Export current DDC rankings.
#-----------------------------------------------------------------------------#
// output headers so that the file is downloaded rather than displayed
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=rankings.csv');

require_once('db.php');
require_once('log.php');
require_once('util.php');

$table = isset($_GET['sweden']) ? 'sweden_ranking' : 'ranking';
$top = $_GET['top'];

$sql = "SELECT * FROM player";
$results = db_query($sql);
foreach ($results as $result) {
  $player[$result['id']] = $result['name'];
}

$sql = "SELECT player_id, division, points, rank FROM $table WHERE year = (SELECT MAX(year) FROM $table)";
if ($top) {
  $sql .= " AND rank <= $top";
}
$sql .= " ORDER BY division,rank";
$results = db_query($sql);

// create a file pointer connected to the output stream
$output = fopen('php://output', 'w');

// output the column headings
fputcsv($output, array('Name', 'Division', 'Points', 'Rank'));

// write query results to output
foreach ($results as $result) {
  $data = array($player[$result['player_id']], $result['division'], $result['points'], $result['rank']);
  fputcsv($output, $data);
}
?>
