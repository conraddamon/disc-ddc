const DEFAULT_PAGE = 'top50';

function initializeRankings() {

    $('.pageLink').click(pageLinkClicked);
    $('#yearSelect').change(refresh);
    $('#sweden').change(function() {
	    refresh();
	    populateYears();
	});

    populateYears();
    let page = parseQueryString().page;
    showPage(page || DEFAULT_PAGE);
}

function refresh() {
    showPage(window.curPage);
}

function populateYears() {

    let sweden = $('#sweden').prop('checked') || !!(parseQueryString()).sweden,
	table = sweden ? 'sweden_ranking' : 'ranking',
	yearSelect = $('#yearSelect'),
	options = { allYears: true };

    if (sweden) {
	options.sweden = true;
    }
    yearSelect.html('');
    sendRequest('get-rankings', options, function(data) {
	    data.forEach(function(row) {
		    yearSelect.append($('<option>', { value: row.year, text: row.year }));
		});
	});
}

function showPage(page) {

    if (page === 'results') {
	window.location = '/results/';
	return;
    }
    else if (page === 'explain') {
	window.location = '/results/rankings_explained.html';
	return;
    }
    else if (page === 'experiment') {
	window.location = '/results/rankings_form.html';
	return;
    }

    let qs = parseQueryString(),
	year = qs.year,
	sweden = !!qs.sweden;

    let doExport = (page === 'export' );

    if (year) {
	$('#yearSelect').val(year);
    }
    else {
	year = $('#yearSelect').val();
	if (year === "0") {
	    year = '';
	}
    }

    if (sweden) {
	$('#sweden').prop('checked', true);
    }
    else {
	sweden = $('#sweden').prop('checked');
    }

    let options = { 
	year: year
    };
    if (sweden) {
	options.sweden = true;
    }

    let limit = window.rankingsLimit;
    if (page && page.indexOf('top') === 0) {
	limit = page.substr(3);
    }
    if (limit && page !== 'all') {
	options.limit = window.rankingsLimit = limit;
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
		    let names = {};
		    data.forEach(p => names[p.id] = p.name);
		    if (doExport) {
			let promise = year ? Promise.resolve() : sendRequest('get-rankings', { maxYear: true });
			promise.then(function(data) {
				if (data && data.length && !year) {
				    data = JSON.parse(data);
				    year = data[0].year;
				}
				exportRankings(rankings, names, year);
			    });
		    }
		    else {
			showRankings(rankings, names);
		    }
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
	    html += '<table class="resultsTable">';
            let players = Object.keys(rankings[div]);
            players.sort((a, b) => rankings[div][a].rank - rankings[div][b].rank);
            players.forEach(function(p) {
                    let score = rankings[div][p].points,
			link = '<a href="./player.html?id=' + p + '&div=' + div + '">' + names[p] + '</a>';

		    html += '<tr><td>' + rankings[div][p].rank + '</td><td>' + link + '</td><td>' + score + '</td></tr>';
		});
	    html += '</table>';
	});

    $('#content').html(html);
}

function exportRankings(rankings, names, year) {

    const latest = {};
    const updateLatest = (data) => {
	data.forEach(record => {
		const year = Number(record.latest.split('-')[0]);
		const player = record.player;
		latest[player] = Math.max(latest[player] || 0, year);
	    });
    };

    const num = {};
    const updateNum = (data) => {
	data.forEach(record => num[record.player] = ((num[record.player] || 0) + Number(record.num)));
    }

    const doExport = () => {
	let divs = Object.keys(rankings);
	let csv = '';

	csv += 'Year,Division,Name,Rank,Points,Latest,Num,ID\n';
	divs.forEach(function(div) {
		let players = Object.keys(rankings[div]);
		players.sort((a, b) => rankings[div][a].rank - rankings[div][b].rank);
		players.forEach(function(p) {
			let score = rankings[div][p].points;
			let row = [ year, div, names[p], rankings[div][p].rank, score, latest[p], num[p], p ].join(',');
			csv += row + '\n';
		    });
	    });
	
	csv = 'data:text/csv;charset=utf-8,' + csv;
	data = encodeURI(csv);
	
	link = document.createElement('a');
	link.setAttribute('href', data);
	link.setAttribute('download', 'ddc-rankings.csv');
	document.getElementById('content').appendChild(link);
	link.click();
    };

    const req1 = sendRequest('get-latest-year-played', { which: 'player1' });
    const req2 = sendRequest('get-latest-year-played', { which: 'player2' });
    const req3 = sendRequest('get-num-results', { which: 'player1' });
    const req4 = sendRequest('get-num-results', { which: 'player2' });
    sendRequests([ req1, req2, req3, req4 ], [ updateLatest, updateLatest, updateNum, updateNum ]).then(() => doExport());
}
