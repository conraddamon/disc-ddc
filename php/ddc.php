<?php

require_once('common.php');

$DIV_ORDER = array('O','OM','OGM','OSGM','OL','W','WM','WGM','WSGM','WL','OJ','WJ','MX');

$DIV_NAME['O'] = 'Open';
$DIV_NAME['OM'] = 'Master';
$DIV_NAME['OGM'] = 'Grandmaster';
$DIV_NAME['OSGM'] = 'Senior Grandmaster';
$DIV_NAME['OL'] = 'Legend';
$DIV_NAME['W'] = 'Women';
$DIV_NAME['WM'] = 'Women Master';
$DIV_NAME['WGM'] = 'Women Grandmaster';
$DIV_NAME['WSGM'] = 'Women Senior Grandmaster';
$DIV_NAME['WL'] = 'Women Legend';
$DIV_NAME['OJ'] = 'Junior';
$DIV_NAME['WJ'] = 'Women Junior';
$DIV_NAME['MX'] = 'Mixed';

function getTeamName($result, $doLink) {

  $teamMembers = array();
  if ($result['player1'] != 0) {
    array_push($teamMembers, $doLink ? "<a href='./player.html?id=" . $result['player1'] . "'>" . $result['name1'] . "</a>" : $result['name1']);
  }
  if ($result['player2'] != 0) {
    array_push($teamMembers, $doLink ? "<a href='./player.html?id=" . $result['player2'] . "'>" . $result['name2'] . "</a>" : $result['name2']);
  }

  return implode(' / ', $teamMembers);
}

function by_division($a, $b) {

  global $DIV_ORDER;

  $idxA = array_search($a['division'], $DIV_ORDER);
  $idxB = array_search($b['division'], $DIV_ORDER);
  if ($idxA != $idxB) {
    return $idxA - $idxB;
  }

  $placeA = $a['place'];
  $placeB = $b['place'];
  if ($placeA != $placeB) {
    return $placeA - $placeB;
  }

  $teamA = getTeamName($a, false);
  $teamB = getTeamName($b, false);

  return by_name($teamA, $teamB);
}
?>
