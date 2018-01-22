function initializeRankings() {

    let qs = parseQueryString(),
	year = qs.year;

    $('.pageLink').click(pageLinkClicked);
    $('#yearSelect').change(yearSelected);
    showPage('top50');
}

function yearSelected() {
    let year = $(this).val();
    showPage(window.curPage, year);
}

function showPage(page, year) {

    let options = { year: year };
    if (page && page !== 'all') {
	options.limit = page.substr(3);
    }

    let title = "Double Disc Court: Rankings" + (year ? " for " + year : "");
    window.title = title;
    $('.title').text(title);

    // current selection is underlined
    $('#' + window.curPage).removeClass('current');
    $('#' + page).addClass('current');
    window.curPage = page;

    sendRequest('get-rankings', options).then(function(data) {
	    data = JSON.parse(data);
	    let rankings = {};
	    data.forEach(function(r) {
		    let div = r.division;
		    rankings[div] = rankings[div] || {};
		    rankings[div][r.player_id] = {};
		    rankings[div][r.player_id].points = r.points || 0;
		    rankings[div][r.player_id].rank = r.rank;
		});
	    sendRequest('load-player').then(function(data) {
		    data = JSON.parse(data);
		    let names = {},
			dead = {};

		    data.forEach(p => names[p.id] = p.name);
		    showRankings(rankings, names, year ? {} : dead);
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
            let players = Object.keys(rankings[div]);
            players.sort((a, b) => rankings[div][a].rank - rankings[div][b].rank);
            players.forEach(function(p, idx) {
                    let score = rankings[div][p].points,
			link = '<a href="./player.html?id=' + p + '&div=' + div + '">' + names[p] + '</a>';

		    html += '<tr><td>' + rankings[div][p].rank + '</td><td>' + link + '</td><td>' + score + '</td></tr>'
		});
	    html += '</table>';
	});

    $('#content').html(html);
}
