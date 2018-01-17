const POINT_BASE = {
    'A': 50,
    'B': 125,
    'C': 200,
    'D': 250
};

const POINT_FACTOR = 1.1;
const TIME_FACTOR = 1.1;
const NUM_SCORES = 10;
//const DIV_ORDER = [ 'O', 'W', 'OJ', 'WJ', 'OM', 'WM', 'OGM', 'WGM', 'OSGM', 'WSGM', 'OL', 'MX' ];

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

function getRankings(date, points, tournaments) {

    let year = Number((date.split('-'))[0]),
	rankingPoints = {};

    Object.keys(points).forEach(function(tid) {
	    let tournament = tournaments[tid],
		//                tournamentYear = tournament.end.getFullYear(),
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

    let divs = Object.keys(rankingPoints).sort((a, b) => DIV_ORDER.indexOf(a) - DIV_ORDER.indexOf(b)),
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
