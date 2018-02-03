"use strict";

/*
 * Code to calculate DDC player rankings.
 *
 * 2018-01-29: Remove reduction for non-full tournament
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

// Number of entrants for a tournament to be considered to have had good turnout
const FULL_TOURNEY = 20;

// How steeply to degrade points based on finish. A higher number means bigger gaps at the top.
const POINT_FACTOR = 1.1;

// How steeply to degrade points based on age (how many seasons ago).
const TIME_FACTOR = 1.1;

// How many of a player's top scores to count in their ranking
const NUM_SCORES = 10;

// Order in which to show divisions (if displaying rankings)
const SETTING = {};
SETTING.DIV_ORDER = typeof DIV_ORDER == 'undefined' ? [ 'O', 'W', 'OJ', 'WJ', 'OM', 'WM', 'OGM', 'WGM', 'OSGM', 'WSGM', 'OL', 'MX' ] : DIV_ORDER;

const BONUS = [];
(function() {
    for (let i = 1; i <= 200; i++) {
	if (i <= 5) {
	    BONUS[i] = 10;
	}
	else if (i <= 10) {
	    BONUS[i] = 7.5;
	}
	else if (i <= 20) {
	    BONUS[i] = 5;
	}
	else if (i <= 50) {
	    BONUS[i] = 2.5;
	}
	else if (i <= 100) {
	    BONUS[i] = 1;
	}
	else {
	    BONUS[i] = 0.5;
	}
    }
})();

// how many tournaments to fetch results for at a time
const CHUNK_SIZE = 50;

// Connect to Mysql
let db;
if (typeof require !== 'undefined') {
    let mysql = require('mysql');
    db = mysql.createConnection({
	    host    : 'localhost',
	    user    : 'cdamon',
	    password: 'Lmdc1ddc',
	    database: 'cdamon_ddc'
	});
    db.connect();
}

// Remember player names in case we're called more than once
let playerNames = {};

function generateRankings(options) {

    options = options || {};
    options.pointBase = options.pointBase || POINT_BASE;
    options.numScores = options.numScores || NUM_SCORES;
    options.pointFactor = options.pointFactor || POINT_FACTOR;
    options.timeFactor = options.timeFactor || TIME_FACTOR;
    options.fullTourney = options.fullTourney || FULL_TOURNEY;

    return new Promise(function(resolve, reject) {

	    let order = options.all ? 'ASC' : 'DESC',
		query = "SELECT MIN(end) AS first, MAX(end) AS last FROM tournament",
		firstYear, lastYear,
		funcs = [];

	    if (options.sweden) {
		query = query + " WHERE FIND_IN_SET('sweden',tags) > 0";
	    }

	    // first, figure out the time period we need results from
	    dbQuery(query, options)
		.then(function(data) {
			firstYear = toMysqlDate(data[0].first).substr(0, 4);
			lastYear = toMysqlDate(data[0].last).substr(0, 4);
			// delete existing rankings
			return !options.test && options.save ? deleteRecords(options) : Promise.resolve();
		    })
		.then(function() {
			// historical rankings
			if (options.all) {
			    // create a list of functions that will generate rankings
			    for (let year = firstYear; year <= lastYear; year++) {
				funcs.push(calculateRankings.bind(null, year, options));
			    }
			    
			    // invoke the functions
			    promiseSerial(funcs).then(function() {
				    if (db) {
					db.end();
				    }
				});
			}
			// current rankings
			else {
			    calculateRankings(lastYear, options).then(function(rankings) {
				    resolve(rankings);
				    if (db) {
					db.end();
				    }
				});
			}
		    });
    });
}

/*
 * Deletes either latest or all rankings.
 *
 * @param {boolean} all    if true, delete all rankings; otherwise, just delete the latest ones
 *
 * @return Promise
 */
function deleteRecords(options) {

    options = options || {};

    let table = options.sweden ? 'sweden_ranking' : 'ranking',
	query = "DELETE r FROM " + table + " r JOIN (SELECT MAX(year) AS maxyear FROM " + table + ") x ON r.year = x.maxyear";

    if (options.all) {
	query = "DELETE FROM " + table;
    }

    return dbQuery(query, options);
}

// Executes a series of Promises serially.
// from https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
const promiseSerial = funcs =>
    funcs.reduce((promise, func) =>
		 promise.then(result => func().then(Array.prototype.concat.bind(result))),
		 Promise.resolve([]));

/*
 * Calculates rankings based on fixed points. Returns a promise so it can be called many times in series.
 *
 * @param {string} year     cutoff year for tournaments to consider (based on their end date)
 */
function calculateRankings(year, options) {

    options = options || {};

    return new Promise(function(resolve, reject) {

	    // get tournament data
	    console.log('Year: ' + year);
	    let tournamentData;
	    getTournaments(year, options)
		.then(function(data) {
			tournamentData = data;
			return options.test ? getPlayerNames() : Promise.resolve();
		    })
		.then(function() {
			return getPlayerRankings(year);
		})
		.then(function(rankingData) {

		    let curRankings = {};
                    rankingData.forEach(function(row) {
                            let y = row.year,
				div = row.division;

                            curRankings[y] = curRankings[y] || {};
                            curRankings[y][div] = curRankings[y][div] || {};
                            curRankings[y][div][row.player_id] = row.rank;
                        });
	    
		    let promises = [],
			tournaments = {},
			results = [];

		    // request results in chunks
		    tournamentData.sort((a, b) => a.id - b.id);
		    let ids = [];
		    for (let i = 0; i < tournamentData.length; i++) {
			let tournament = tournamentData[i],
			    id = tournament.id;

			tournament.end = toMysqlDate(tournament.end);
			tournaments[id] = tournament;
			ids.push(id);
			if ((i + 1) % CHUNK_SIZE === 0) {
			    promises.push(getResults(ids));
			    ids = [];
			}
		    }
		    if (ids.length) {
			promises.push(getResults(ids));
		    }
			
		    let tournamentsPromise = Promise.all(promises);
		    tournamentsPromise.then(function(results) {
			    // flatten chunks into single list of results
			    results = [].concat.apply([], results);

			    // organize results by tournament
			    let points = {},
				resultsByTournament = {};

			    results.forEach(function(result) {
				    let tid = result.tournament_id;
				    resultsByTournament[tid] = resultsByTournament[tid] || [];
				    resultsByTournament[tid].push(result);
				});
				
			    // award ranking points for each tournament
			    Object.keys(resultsByTournament).forEach(function(tid) {
				    getPoints(points, resultsByTournament[tid], tournaments[tid], curRankings, options);
				});

			    // add up ranking points by player
			    let rankings = getRankings(year, points, tournaments, options);
			    if (options.test) {
				if (options.save) {
				    showPoints(rankings, playerNames);
				}
				resolve(rankings);
			    }
			    else {
				if (options.save) {
				    writePoints(rankings, year, options).then(function() {
					    resolve(rankings);
					});
				}
				else {
				    resolve(rankings);
				}
			    }
			});
		    });
    });
}

/*
 * Awards ranking points for each player in a tournament.
 *
 * @param {object} points         used to accumulate results
 * @param {object} results        results for a single tournament
 * @param {object} tournament     tournament data
 * @param {object} rankings       rankings up to now (for awarding bonus points)
 * @param {object} options
 */
function getPoints(points, results, tournament, rankings, options) {

    options = options || {};

    // figure out point base
    let level = tournament.level,
	base = options.pointBase[level],
	numEntrants = results.length;

    // for non-championship tournament, bump base down if not fully attended
    /*
    if (level !== 'D' && numEntrants < options.fullTourney) {
	base = .5 * base + (.5 * (numEntrants / options.fullTourney) * base);
    }
    */
    
    // determine how many players finished in each place so we can account for ties (and solo play)
    let placeCount = {};
    results.forEach(function(result) {
	    let p = result.place,
		div = result.division,
		num = [ result.player1, result.player2 ].filter(p => p != 0).length;
	    
	    placeCount[div] = placeCount[div] || {};
	    placeCount[div][p] = placeCount[div][p] ? placeCount[div][p] + num : num;
	});
    
    // figure out how many points to award to each place
    let placePoints = {};
    Object.keys(placeCount).forEach(function(tid) {
	Object.keys(placeCount).forEach(function(div) {
		Object.keys(placeCount[div]).forEach(function(place) {
			let p = Number(place);
			placePoints[div] = placePoints[div] || {};
			placePoints[div][place] = 0;
			for (let i = 0; i < placeCount[div][place]; i++) {
			    placePoints[div][place] += base * (1 / (Math.pow(options.pointFactor, p + i - 1)));
			}
		    });
	    });
	});

    // find the latest set of rankings before the tournament
    let rankingYears = Object.keys(rankings).sort(),
        tournamentYear = tournament.end.substr(0, 4),
	rankingYear;

    for (let i = 0; i < rankingYears.length; i++) {
        if (rankingYears[i] >= tournamentYear) {
            break;
        }
	rankingYear = rankingYears[i];
    }
    
    // award points by tournament/division/player
    let tid = tournament.id;
    let divFound = {};
    results.forEach(r => divFound[r.division] = true);
    Object.keys(divFound).forEach(function(div) {
            let divResults = results.filter(r => r.division === div).sort((a, b) => b.place - a.place),
		bonus = 0,
		totalBonus = 0,
		curPlace = 0;

	    divResults.forEach(function(result) {
		    let place = result.place,
			pts = Number(Math.max(placePoints[div][place] / placeCount[div][place], 1));
		    
		    if (place !== curPlace && totalBonus > 0) {
			bonus = totalBonus;
		    }
		    pts += bonus;
		    
		    points[tid] = points[tid] || {};
		    points[tid][div] = points[tid][div] || {};
		    [ result.player1, result.player2 ].forEach(p => { 
			    if (p > 0) {
				points[tid][div][p] = pts.toFixed(2);
				let b = (rankings[rankingYear] && rankings[rankingYear][div] && BONUS[rankings[rankingYear][div][p]]) || 0;
				totalBonus += b;
			    }
			});
		    curPlace = place;
		});
	});
    
    return points;
}

/*
 * Calculates ranking points by division for each player. Degrades older results and takes the top score
 * for each player. The data returned is in the form ranking[division][player_id].
 *
 * @param {string} year    year that rankings are for
 */
function getRankings(year, points, tournaments, options) {

    options = options || {};

    let rankingPoints = {};

    // degrade results by age
    Object.keys(points).forEach(function(tid) {
	    let tournament = tournaments[tid],
                tournamentYear = tournament.end.substr(0, 4),
                yearDelta = year - tournamentYear;

	    Object.keys(points[tid]).forEach(function(div) {
		    rankingPoints[div] = rankingPoints[div] || {};
		    Object.keys(points[tid][div]).forEach(function(pid) {
			    let pts = Number(points[tid][div][pid]) * (1 / Math.pow(options.timeFactor, yearDelta));
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
                    ranking[div][p] = scores.slice(0, options.numScores).reduce((a, b) => a + b);
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
		db.query('SELECT id,name FROM player', function(error, results) {
			if (!error) {
			    results.forEach(p => playerNames[p.id] = p.name);
			    resolve(playerNames);
			}
		    });
	    }
    });
}

// Writes rankings to the database
function writePoints(points, year, options) {

    options = options || {};

    let promises = [],
	table = options.sweden ? 'sweden_ranking' : 'ranking';

    Object.keys(points).forEach(function(div) {
	    let players = Object.keys(points[div]),
		curPoints, rank;

	    players.sort((a, b) => points[div][b] - points[div][a]);
	    players.forEach(function(p, idx) {
		    let pts = points[div][p].toFixed(2);
		    if (pts != curPoints) {
			rank = idx + 1;
		    }
		    let values = [ p, quote(div), quote(year), pts, rank ].join(', '),
			query = 'INSERT INTO ' + table + '(player_id, division, year, points, rank) VALUES(' + values + ')';

		    promises.push(new Promise(function(resolve, reject) {
				if (options.test) {
				    console.log(query);
				    resolve();
				}
				else {
				    db.query(query, function(error, results) {
					    resolve();
					});
				}
		    }));
		    curPoints = pts;
		});

	});

    return Promise.all(promises);
}

// Writes player names and rankings to the console
function showPoints(points, names) {

    let divs = Object.keys(points);
    divs.sort((a, b) => SETTING.DIV_ORDER.indexOf(a) - SETTING.DIV_ORDER.indexOf(b));
    divs.forEach(function(div) {
	    console.log('\n' + div + '\n');
	    let players = Object.keys(points[div]);
	    players.sort((a, b) => points[div][b] - points[div][a]);
	    players.forEach(function(p, idx) {
		    console.log((idx + 1) + '. ' + names[p] + ': ' + points[div][p].toFixed(2));
		});
	});
}

/*
 * Returns a promise that fetches tournaments that ended during or before the given year.
 *
 * @param {string} year    latest year to get tournaments for
 *
 * @return Promise
 */
function getTournaments(year, options) {

    options = options || {};

    let query = "SELECT id,end,name,level FROM tournament WHERE end <= '" + year + "-12-31'";
    if (options.sweden) {
	query += " AND FIND_IN_SET('sweden',tags) > 0";
    }
    return dbQuery(query, options);
}

function getResults(ids) {

    return dbQuery("SELECT * FROM result WHERE tournament_id IN (" + ids.join(',') + ")");
}

/*
 * Returns a promise that fetches results for the given tournament.
 *
 * @param {string} tournamentId    tournament ID
 *
 * @return Promise
 */
function getTournament(tournamentId) {

    return dbQuery("SELECT * FROM result WHERE tournament_id=" + tournamentId);
}

/*
 * Returns a promise that fetches player rankings up to the given year
 *
 * @param {string} year    latest year to get rankings for
 *
 * @return Promise
 */
function getPlayerRankings(year, options) {

    options = options || {};

    let table = options.sweden ? 'sweden_ranking' : 'ranking';
    return dbQuery("SELECT * FROM " + table + " WHERE year <= '" + year + "'", options);
}

function dbQuery(query, options) {

    options = options || {};

    return new Promise(function(resolve, reject) {

	    // check for write
	    if (options.test && query.indexOf('SELECT') === -1) {
		console.log(query);
		resolve();
	    }
	    else {
		if (options.test) {
		    console.log(query);
		}
		if (db) {
		    db.query(query, function(error, data) {
			    if (error) {
				console.log(error);
				reject(error);
			    }
			    else {
				resolve(data || []);
			    }
			});
		}
		else {
		    console.log('sending request: ' + query);
		    sendRequest('run-query', { sql: query }, function(data) {
			    console.log('got response, resolving');
			    resolve(data || []);
			});
		}
	    }
    });
}

function toMysqlDate(date) {

    if (!date || !date.getMonth) {
	return date;
    }

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

if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
	exports = module.exports;
    }
    exports.generateRankings = generateRankings;
}
