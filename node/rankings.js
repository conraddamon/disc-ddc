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

// Number of entrants for a tournament to be considered to have had good turnout
const FULL_TOURNEY = 20;

// How steeply to degrade points based on finish. A higher number means bigger gaps at the top.
const POINT_FACTOR = 1.1;

// How steeply to degrade points based on age (how many seasons ago).
const TIME_FACTOR = 1.1;

// How many of a player's top scores to count in their ranking
const NUM_SCORES = 10;

// Order in which to show divisions (if displaying rankings)
const DIV_ORDER = [ 'O', 'W', 'OJ', 'WJ', 'OM', 'WM', 'OGM', 'WGM', 'OSGM', 'WSGM', 'OL', 'MX' ];

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

let debug;

/*
 * Calculates rankings based on fixed points. Returns a promise so it can be called many times in series.
 *
 * @param {string} date     cutoff date for tournaments to consider (based on their end date), in Mysql format eg '1995-12-31'
 */
function calculateRankings(date, options) {

    debug = options.debug;

    return new Promise(function(resolve, reject) {

	    // get tournament data
	    console.log('\n' + 'Date: ' + date + '\n');
	    let tournamentData;
	    getTournaments(date)
		.then(function(data) {
			tournamentData = data;
			return debug ? getPlayerNames() : Promise.resolve();
		    })
		.then(function() {
			return getPlayerRankings(date);
		})
		.then(function(rankingData) {

		    let curRankings = {};
                    rankingData.forEach(function(row) {
                            let d = toMysqlDate(row.date),
				div = row.division;

                            curRankings[d] = curRankings[d] || {};
                            curRankings[d][div] = curRankings[d][div] || {};
                            curRankings[d][div][row.player_id] = row.rank;
                        });
	    
		    let promises = [],
			tournaments = {},
			results = [];
			
			for (let i = 0; i < tournamentData.length; i++) {
			    let tournament = tournamentData[i];
			    tournament.end = toMysqlDate(tournament.end);
			    tournaments[tournament.id] = tournament;
			    promises.push(processTournament(tournament, date, results));
			}
			let tournamentsPromise = Promise.all(promises);
			tournamentsPromise.then(function(results) {
				let points = {};
				results.forEach(function(tournamentResults) {
					let tid = tournamentResults[0].tournament_id;
					getPoints(points, tournamentResults, tournaments[tid], curRankings, options);
				    });
				let rankings = getRankings(date, points, tournaments);
				if (debug) {
				    showPoints(rankings, playerNames);
				}
				else {
				    writePoints(rankings, date).then(function() {
					    resolve();
					});
				}
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

// award points for a tournament
function getPoints(points, results, tournament, rankings, options) {

    // figure out point base
    let level = tournament.level,
	base = POINT_BASE[level],
	numEntrants = results.length;

    // for non-championship tournament, bump base down if not fully attended
    if (level !== 'D' && numEntrants < FULL_TOURNEY) {
	base = .5 * base + (.5 * (numEntrants / FULL_TOURNEY) * base);
    }
    
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
	let base = POINT_BASE[tournament.level];
	Object.keys(placeCount).forEach(function(div) {
		Object.keys(placeCount[div]).forEach(function(place) {
			let p = Number(place);
			placePoints[div] = placePoints[div] || {};
			placePoints[div][place] = 0;
			for (let i = 0; i < placeCount[div][place]; i++) {
			    placePoints[div][place] += base * (1 / (Math.pow(POINT_FACTOR, p + i - 1)));
			}
		    });
	    });
	});

    let rankingDates = Object.keys(rankings).sort(),
        tournamentDate = tournament.end,
	rankingDate;

    for (let i = 0; i < rankingDates.length; i++) {
        if (rankingDates[i] > tournamentDate) {
            break;
        }
	rankingDate = rankingDates[i];
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
			//console.log("Points = " + Math.round(pts) + "; Bonus for " + [tid,div,place].join('/') + " for " + playerNames[result.player1] + ": " + totalBonus);
			bonus = totalBonus;
		    }
		    if (options.bonus) {
			pts += bonus;
		    }
		    
		    points[tid] = points[tid] || {};
		    points[tid][div] = points[tid][div] || {};
		    [ result.player1, result.player2 ].forEach(p => { 
			    if (p > 0) {
				points[tid][div][p] = pts.toFixed(2);
				let b = (rankings[rankingDate] && rankings[rankingDate][div] && BONUS[rankings[rankingDate][div][p]]) || 0;
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

// Writes rankings to the database
function writePoints(points, date) {

    let promises = [];
    Object.keys(points).forEach(function(div) {
	    let players = Object.keys(points[div]),
		curPoints, rank;

	    players.sort((a, b) => points[div][b] - points[div][a]);
	    players.forEach(function(p, idx) {
		    let pts = points[div][p].toFixed(2);
		    if (pts != curPoints) {
			rank = idx + 1;
		    }
		    let values = [ p, quote(div), quote(date), pts, rank ].join(', '),
			query = 'INSERT INTO ranking(player_id, division, date, points, rank) VALUES(' + values + ')';

		    promises.push(new Promise(function(resolve, reject) {
				if (debug) {
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

function getTournaments(date) {

    return dbQuery("SELECT id,end,name,level FROM tournament WHERE end <= '" + date + "'");
}

function getPlayerRankings(date) {

    return dbQuery("SELECT * FROM ranking WHERE date <= '" + date + "'");
}

function dbQuery(query) {

    return new Promise(function(resolve, reject) {

	    // check for write
	    if (debug && query.indexOf('SELECT') === -1) {
		console.log(query);
		resolve();
	    }
	    else {
		//console.log('query: ' + query);
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
    dbQuery: dbQuery,
    calculateRankings: calculateRankings,
    toMysqlDate: toMysqlDate,
    quote: quote
};
