function initializeRankings() {

    let qs = parseQueryString(),
	date = qs.date || toMysqlDate(new Date());
    
    sendRequest('load-tournament', { before: date }).then(function(data) {
	    data = JSON.parse(data);
	    let tournaments = {};
	    data.forEach(t => tournaments[t.id] = t);
	    sendRequest('get-results', { before: date }, gotResults.bind(null, tournaments, date));
	});
}

function gotResults(tournaments, date, results) {

    let points = getFixedPoints(results, tournaments);

    sendRequest('load-player').then(function(data) {
	    data = JSON.parse(data);
	    let names = {};
	    data.forEach(p => names[p.id] = p.name);
	    rankings = getRankings(date, points, tournaments);
	    showRankings(rankings, names);
	});
    


}

function showRankings(rankings, names) {

    let divs = Object.keys(rankings),
	html = '';

    divs.forEach(function(div) {
	    html += '<h2>' + div + '</h2>';
            let players = Object.keys(rankings[div]);
            players.sort((a, b) => rankings[div][b] - rankings[div][a]);
	    html += '<ol>';
            players.forEach(function(p, idx) {
                    let score = rankings[div][p];
		    //                    scores.sort((a, b) => b - a);
		    html += '<li>' + names[p] + ': ' + score.toFixed(2);
		    //                    html += ' <span style="opacity:0.5;">' + scores.length + ' scores: ' + scores.map(s => s.toFixed(2)).join(',') + '</span></li>';
		});
	    html += '</ol>';
	});

    $('#content').html(html);
}


