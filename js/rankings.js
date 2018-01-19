function initializeRankings() {

    let qs = parseQueryString(),
	year = qs.year;

    sendRequest('get-rankings', { year: year }).then(function(data) {
	    data = JSON.parse(data);
	    let rankings = {};
	    data.forEach(function(r) {
		    let div = r.division;
		    rankings[div] = rankings[div] || {};
		    rankings[div][r.player_id] = r.points || 0;
		});
	    sendRequest('load-player').then(function(data) {
		    data = JSON.parse(data);
		    let names = {};
		    data.forEach(p => names[p.id] = p.name);
		    showRankings(rankings, names);
		});
	});
}

function showRankings(rankings, names) {

    let divs = Object.keys(rankings),
	html = '';

    let links = divs.map(function(div) {
	    return { id: div, text: DIV_NAME[div] };
	});
    html += getLinkBar(links, true);

    divs.forEach(function(div) {
	    html += '<h2 id="' + div + '">' + DIV_NAME[div] + '</h2>';
	    html += '<table>';
            let players = Object.keys(rankings[div]),
		i = 1;
            players.sort((a, b) => rankings[div][b] - rankings[div][a]);
            players.forEach(function(p, idx) {
                    let score = rankings[div][p];
		    html += '<tr><td>' + i + '</td><td>' + names[p] + '</td><td>' + score + '</td></tr>'
		    i++;
		});
	    html += '</table>';
	});

    $('#content').html(html);
}
