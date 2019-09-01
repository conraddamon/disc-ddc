<?php
#-----------------------------------------------------------------------------#
# File: ddc.php
# Author: Conrad Damon
# Date: 03/15/2017
#
# This file provides an interface to a database storing data related to 
# DDC tournaments.
#-----------------------------------------------------------------------------#

# Minimal security check to prevent direct access to REST calls
if ($_SERVER['HTTP_X_REQUESTED_WITH'] !== 'XMLHttpRequest') {
  exit('');
}

require_once('db.php');
require_once('log.php');
require_once('util.php');

$op = get_input('op', 'get');
elog(LOG_INFO, "ddc.php, op=$op");

# runs an SQL query
if ($op == 'run-query') {
  $sql = get_input('sql', 'get');
  $result = db_query($sql);
}

# gets data for a tournament
elseif ($op == 'get-tournament') {
  $tournamentId = get_input('tournamentId', 'get');
  $sql = "SELECT * FROM tournament WHERE id=$tournamentId";
  $result = db_query($sql, 'one');
}

# gets tournament info
elseif ($op == 'load-tournament') {
  $sort = get_input('sortBy', 'get');
  $before = get_input('before', 'get');
  $after = get_input('after', 'get');
  $beforeSql = '';
  $afterSql = '';
  $dateSql = '';
  if ($before || $after) {
    if ($before) {
      $beforeSql = "tournament.end <= '$before'";
    }
    if ($after) {
      $afterSql = "tournament.start >= '$after'";
    }
    $dateSql = $before && $after ? " AND $beforeSql AND $afterSql" : " AND $beforeSql $afterSql";
  }
  $order = $sort ? "ORDER BY $sort" : "";
  $sql = "SELECT * FROM tournament WHERE id > 0 $order $dateSql";
  $result = db_query($sql);
}

elseif ($op == 'get-tournament-counts') {
  $division = get_input('division', 'get');
  $sql = "SELECT tournament_id, COUNT(tournament_id) FROM `result` WHERE division='$division' GROUP BY tournament_id";
  $result = db_query($sql);
}

# gets the names of all known DDC players
elseif ($op == 'load-player') {
  $sql = "SELECT * FROM player";
  $result = db_query($sql);
}

# gets the name of a DDC player
elseif ($op == 'get-player') {
  $id = db_quote(get_input('id', 'get'));
  $sql = "SELECT * FROM player WHERE id=$id";
  $result = db_query($sql);
}

# adds a name to the list of DDC players
elseif ($op == 'add-player') {
  $name = db_quote(db_encode(get_input('name', 'get')));
  $sex = get_input('sex', 'get');
  $sql = "INSERT INTO player(name,sex) VALUES($name,'$sex')";
  $result = db_query($sql);
}

elseif ($op == 'get-results') {
  $tournamentId = get_input('tournamentId', 'get');
  $playerId = get_input('playerId', 'get');
  $before = get_input('before', 'get');
  $after = get_input('after', 'get');
  if ($tournamentId) {
    $sql = "SELECT * FROM result WHERE tournament_id=$tournamentId";
  }
  elseif ($playerId) {
    $sql = "SELECT r.*, p1.name AS name1, p2.name AS name2 FROM result r JOIN player p1 ON (p1.id=r.player1) LEFT JOIN player p2 ON (p2.id=r.player2) WHERE player1=$playerId OR player2=$playerId";
  }
  elseif ($before || $after) {
    if ($before) {
      $beforeSql = "tournament.end <= '$before'";
    }
    if ($after) {
      $afterSql = "tournament.start >= '$after'";
    }
    $dateSql = $before && $after ? "$beforeSql AND $afterSql" : "$beforeSql $afterSql";
    $sql = "SELECT result.* FROM result JOIN tournament ON tournament.id=result.tournament_id WHERE $dateSql";
  }
  $result = db_query($sql);
}

elseif ($op == 'add-tournament') {
  $name = db_quote(get_input('name', 'get'));
  $start = date("Y-m-d", strtotime(get_input('start', 'get')));
  $end = date("Y-m-d", strtotime(get_input('end', 'get')));
  $location = get_input('location', 'get');
  $level = get_input('level', 'get');
  $format = get_input('format', 'get');
  $tags = get_input('tags', 'get');
  $note = db_quote(get_input('note', 'get'));
  $sql = "INSERT INTO tournament(name,start,end,location,level,format,tags,description) VALUES($name,'$start','$end','$location','$level','$format','$tags',$note)";
  $result = db_query($sql);
}

elseif ($op == 'add-result') {
  $tournamentId = get_input('tournamentId', 'get');
  $player1 = get_input('player1', 'get');
  $player2 = get_input('player2', 'get');
  $place = get_input('place', 'get');
  $division = get_input('division', 'get');
  $sql = "INSERT INTO result(tournament_id,player1,player2,division,place) VALUES($tournamentId,$player1,$player2,'$division',$place)";
  $result = db_query($sql);
}

elseif ($op == 'get-rankings') {
  $limit = get_input('limit', 'get');
  $year = get_input('year', 'get');
  $player = get_input('player', 'get');
  $maxYear = get_input('maxYear', 'get');
  $allYears = get_input('allYears', 'get');
  $sweden = get_input('sweden', 'get');

  $table = $sweden ? 'sweden_ranking' : 'ranking';

  if ($maxYear) {
    $sql = "SELECT MAX(year) AS year FROM $table";
  }
  elseif ($allYears) {
    $sql = "SELECT DISTINCT(year) FROM $table ORDER BY year DESC";
  }
  elseif ($player) {
    $sql = "SELECT player_id, division, year, points, rank FROM $table WHERE player_id=$player";
  }
  elseif ($year) {
    $sql = "SELECT player_id, division, points, rank FROM $table WHERE year='$year'";
  }
  else {
    $sql = "SELECT player_id, division, points, rank FROM $table WHERE year = (SELECT MAX(year) FROM $table)";
  }
  if ($limit) {
    $sql = $sql . " AND rank <= $limit";
  }
  $result = db_query($sql);
}

elseif ($op == 'get-latest-year-played') {
  $which = get_input('which', 'get');
  $sql = "SELECT MAX(t.start) AS latest, r.$which AS player FROM tournament t JOIN result r ON t.id=r.tournament_id WHERE $which > 0 GROUP BY r.$which";
  $result = db_query($sql);
}

elseif ($op == 'get-num-results') {
  $which = get_input('which', 'get');
  $sql = "SELECT $which AS player, COUNT(*) AS num FROM result WHERE $which > 0 GROUP BY $which";
  $result = db_query($sql);
}

echo json_encode(db_encode($result));
?>
