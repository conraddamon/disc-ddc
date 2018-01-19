/*
 * Functions to help server-side calculation of DDC player rankings.
 */

/*
 * Point bases that depend on the level of the tournament.
 *
 *     A: small/local/impromptu tournament
 *     B: small to moderate, mainly local tournament (eg a lesser state tournament or a series tournament)
 *     C: major tournament (eg VA States, Swedisc, East Coast, West Coast, Tally Rally)
 *     D: championship tournament (WFDF or US Open)
 *
 * The point gaps reflect that the biggest jumps are from A to B and B to C.
 */
const POINT_BASE = {
    'A': 50,
    'B': 125,
    'C': 200,
    'D': 250
};

// How steeply to degrade points based on finish. A higher number means bigger gaps at the top.
const POINT_FACTOR = 1.1;

// How steeply to degrade points based on age (how many seasons ago).
const TIME_FACTOR = 1.1;

// How many of a player's top scores to count in their ranking
const NUM_SCORES = 10;

// Order in which to show divisions (if displaying rankings)
const DIV_ORDER = [ 'O', 'W', 'OJ', 'WJ', 'OM', 'WM', 'OGM', 'WGM', 'OSGM', 'WSGM', 'OL', 'MX' ];

// Connect to Mysql
let mysql = require('mysql');
let db = mysql.createConnection({
	host    : 'localhost',
	user    : 'cdamon',
	password: 'Lmdc1ddc',
	database: 'cdamon_ddc'
    });

db.connect();

// Remember player names in case we're called more than once
let playerNames = {};

/*
 * Main function and entry point. Returns a promise so it can be called many times in series.
 *
 * @param {string} date     cutoff date for tournaments to consider (based on their end date)
 */
function calculateRankings(date) {

    return new Promise(function(resolve, reject) {

	    // get tournament data
	    console.log('\n' + 'Date: ' + date + '\n');
	    let query = "SELECT id,end,name,level FROM tournament WHERE end <= '" + date + "'";
	    db.query(query, function(error, data) {

		    if (!data || !data.length) {
			return;
		    }

		    getPlayerNames().then(function(names) {
	    
			    let promises = [],
				tournaments = {},
				results = [];
				
			    for (let i = 0; i < data.length; i++) {
				let tournament = data[i];
				tournament.end = toMysqlDate(tournament.end);
				tournaments[tournament.id] = tournament;
				promises.push(processTournament(tournament, date, results));
			    }
			    let tournamentsPromise = Promise.all(promises);
			    tournamentsPromise.then(function(results) {
				    results = [].concat.apply([], results);
				    let points = getFixedPoints(results, tournaments);
				    let rankings = getRankings(date, points, tournaments);
				    //showPoints(rankings, names);
				    writePoints(rankings, date).then(function() {
					    resolve();
					});
				});
			});
		});
    });
}

/*
 * Returns a promise that fetches results for the given tournament.
 *
 * @param {object} tournament    tournament
 */
function processTournament(tournament, date, results) {

    return new Promise(function(resolve, reject) {

	    let query = 'SELECT * FROM result WHERE tournament_id=' + tournament.id,
		year = Number((date.split('-'))[0]),
		tournamentYear = tournament.end.substr(0, 4),
		yearDelta = year - tournamentYear;

	    db.query(query, function(error, data) {
		    if (!error) {
			resolve(data);
		    }
		});
    });
}

/*
 * Returns fixed points for each tournament/division/player
 */
function getFixedPoints(results, tournaments) {

    // determine how many players finished in each place so we can account for ties (and solo play)
    let placeCount = {};
    results.forEach(function(result) {
	    let p = result.place,
		tid = result.tournament_id,
		div = result.division,
		num = [result.player1, result.player2].filter(p => p != 0).length;
	    
	    placeCount[tid] = placeCount[tid] || {};
	    placeCount[tid][div] = placeCount[tid][div] || {};
	    placeCount[tid][div][p] = placeCount[tid][div][p] ? placeCount[tid][div][p] + num : num;
	});
    
    // figure out how many points to award to each place
    let placePoints = {};
	
    Object.keys(placeCount).forEach(function(tid) {
	let base = POINT_BASE[tournaments[tid].level];
	Object.keys(placeCount[tid]).forEach(function(div) {
		Object.keys(placeCount[tid][div]).forEach(function(place) {
			let p = Number(place);
			placePoints[tid] = placePoints[tid] || {};
			placePoints[tid][div] = placePoints[tid][div] || {};
			placePoints[tid][div][place] = 0;
			for (let i = 0; i < placeCount[tid][div][place]; i++) {
			    placePoints[tid][div][place] += base * (1 / (Math.pow(POINT_FACTOR, p + i - 1)));
			}
		    });
	    });
	});
    
    // award points by tournament/division/player
    let points = {};
    results.forEach(function(result) {
	    let p = result.place,
		tid = result.tournament_id,
		div = result.division,
		pts = Number(Math.max(placePoints[tid][div][p] / placeCount[tid][div][p], 1).toFixed(2));
	    
	    points[tid] = points[tid] || {};
	    points[tid][div] = points[tid][div] || {};
	    [ result.player1, result.player2 ].forEach(p => { if (p > 0) points[tid][div][p] = pts });
	});
    
    return points;
}

/*
 * Calculates ranking points by division for each player. Degrades older results and takes the top score
 * for each player.
 */
function getRankings(date, points, tournaments) {

    let year = Number((date.split('-'))[0]),
	rankingPoints = {};

    // degrade results by age
    Object.keys(points).forEach(function(tid) {
	    let tournament = tournaments[tid],
                tournamentYear = tournament.end.substr(0, 4),
                yearDelta = year - tournamentYear;

	    Object.keys(points[tid]).forEach(function(div) {
		    rankingPoints[div] = rankingPoints[div] || {};
		    Object.keys(points[tid][div]).forEach(function(pid) {
			    let pts = Number(points[tid][div][pid]) * (1 / Math.pow(TIME_FACTOR, yearDelta));
			    rankingPoints[div][pid] = rankingPoints[div][pid] || [];
			    rankingPoints[div][pid].push(pts);
			});
		});
	});

    // sum top results for each player to get their ranking
    let divs = Object.keys(rankingPoints),
	ranking = {};

    divs.forEach(function(div) {
            ranking[div] = ranking[div] || {};
            let players = Object.keys(rankingPoints[div]);
            players.forEach(function(p) {
                    let scores = rankingPoints[div][p];
                    scores.sort((a, b) => b - a);
                    ranking[div][p] = scores.slice(0, NUM_SCORES).reduce((a, b) => a + b);
		});
	});

    return ranking;
}

// Returns a hash mapping player ID to name.
function getPlayerNames() {

    return new Promise(function(resolve, reject) {
	    if (Object.keys(playerNames).length > 0) {
		resolve(playerNames);
	    }
	    else {
		console.log('getting player names');
		db.query('SELECT id,name FROM player', function(error, results) {
			if (!error) {
			    results.forEach(p => playerNames[p.id] = p.name);
			    resolve(playerNames);
			}
		    });
	    }
    });
}

function writePoints(points, date) {

    let promises = [];
    Object.keys(points).forEach(function(div) {
	    let players = Object.keys(points[div]);
	    players.forEach(function(p, idx) {
		    let values = [ p, quote(div), quote(date), points[div][p].toFixed(2) ].join(', '),
			query = 'INSERT INTO ranking(player_id, division, date, points) VALUES(' + values + ')';

		    promises.push(new Promise(function(resolve, reject) {
				//console.log(query);
				db.query(query, function(error, results) {
					resolve();
				    });
		    }));
		});

	});

    return Promise.all(promises);
}

function showPoints(points, names) {

    let divs = Object.keys(points);
    divs.sort((a, b) => DIV_ORDER.indexOf(a) - DIV_ORDER.indexOf(b));
    divs.forEach(function(div) {
	    console.log('\n' + div + '\n');
	    let players = Object.keys(points[div]);
	    players.sort((a, b) => points[div][b] - points[div][a]);
	    players.forEach(function(p, idx) {
		    console.log((idx + 1) + '. ' + names[p] + ': ' + points[div][p].toFixed(2));
		});
	});
}

function toMysqlDate(date) {

    let month = date.getMonth() + 1,
        day = date.getDate(),
        year = date.getYear() + 1900;

    month = month < 10 ? '0' + month : month;
    day = day < 10 ? '0' + day : day;

    return [year, month, day].join('-');
}

function quote(str) {
    return "'" + str + "'";
}

module.exports = {
    db: db,
    calculateRankings: calculateRankings,
    toMysqlDate: toMysqlDate,
    quote: quote
};


