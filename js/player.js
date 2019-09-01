function initializePlayer(playerId) {

    window.playerId = playerId;

    $('.pageLink').click(pageLinkClicked);

    var getResults = sendRequest('get-results', { playerId: playerId }),
	getTournaments = sendRequest('load-tournament');

    var requests = [ getResults, getTournaments ],
	callbacks = [ gotResults, gotTournaments ];

    sendRequests(requests, callbacks).then(() => showPage('results'));
}

function gotResults(data) {

    window.resultData = {};
    if (data) {
	data.forEach(result => window.resultData[result.id] = result);
    }
}

function gotTournaments(data) {

    window.tournamentData = {};
    if (data) {
	data.forEach(tournament => window.tournamentData[tournament.id] = tournament);
    }
}

function showPage(page, tournament) {

    $('#content').html('');

    // current selection is underlined
    $('#' + window.curPage).removeClass('current');
    $('#' + page).addClass('current');
    window.curPage = page;

    switch(page) {

    case 'results': {
	showResults(tournament);
	break;
    }
 
    case 'stats': {
	showStats();
	break;
    }

    case 'rankingGraph': {
	window.location = "./ranking_chart.html?id=" + window.playerId;
	break;
    }

    case 'rankings': {
	window.location = "./rankings.html";
	break;
    }

    }
}

function showResults(tournament) {

    $('#content').append('<table class="resultsTable" id="resultsTable"></table>');

    var html = '<tr>';
    [ 'Date', 'Tournament', 'Division', 'Place', 'Partner' ].forEach(column => html += getResultHeader(column, 'result'));
    html += '</tr>';
    $('#resultsTable').append(html);

    displayResults('date', tournament);

    $('#resultsTable th span').click(sortResults);
}

function getResultHeader(column, idPrefix) {

    let id = [ idPrefix, column.toLowerCase() ].join('_');
    return '<th class="ddcHeader" id="' + id + '"><span class="pageLink">' + column + '</span></th>';
}

function sortResults(e) {

    var id = $(this).closest('th').prop('id'),
        column = id.replace('result_', '');

    if (!column) {
        return;
    }

    displayResults(column);
}

function displayResults(column='date', tournament) {

    var resultIds = Object.keys(window.resultData);

    if (tournament) {
	resultIds = resultIds.filter(function(id) {
		let tName = window.tournamentData[window.resultData[id].tournament_id].name;
		return (tName === tournament);
	    });
    }

    // current sort header is underlined
    $('#resultsTable span.current').removeClass('current');
    $('#result_' + column + ' span').addClass('current');

    if (column === 'date') {
	resultIds.sort((a, b) => by_date(a, b));
    }
    else if (column === 'tournament') {
	resultIds.sort((a, b) => by_tournament(a, b));
    }
    else if (column === 'division') {
	resultIds.sort((a, b) => by_division(a, b));
    }
    else if (column === 'place') {
	resultIds.sort((a, b) => by_place(a, b));
    }
    else if (column === 'partner') {
	resultIds.sort((a, b) => by_partner(a, b));
    }

    var html = '',
	table = $('#resultsTable').get(0);

    resultIds.forEach(function(resultId, index) {
	    var rowHtml = '',
		row = table.rows[index + 1] || table.insertRow(),
		result = window.resultData[resultId],
		tournament = window.tournamentData[result.tournament_id],
		date = getShortDate(fromMysqlDate(tournament.start)),
		partnerId = result.player1 == window.playerId ? result.player2 : result.player1,
		partner = result.player1 == window.playerId ? result.name2 : result.name1,
		partnerHtml = !partner ? '' : '<a href="player.html?id=' + partnerId + '">' + partner + '</a>';

	    rowHtml += '<tr>';
	    rowHtml += '<td class="ddcCell">' + date + '</td>';
	    rowHtml += '<td class="ddcCell"><a href="tournament.html?id=' + tournament.id + '">' + tournament.name + '</a></td>';
	    rowHtml += '<td class="ddcCell">' + DIV_NAME[result.division] + '</td>';
	    rowHtml += '<td class="ddcCell">' + result.place + '</td>';
	    rowHtml += '<td class="ddcCell">' + partnerHtml + '</td>';
	    rowHtml += '</tr>';

	    row.innerHTML = rowHtml;
	});
}

function by_date(a, b) {

    var tournamentA = window.tournamentData[window.resultData[a].tournament_id],
	tournamentB = window.tournamentData[window.resultData[b].tournament_id],
	test = compareDates(tournamentB.start, tournamentA.start);

    return test !== 0 ? test : compareTournaments(tournamentA, tournamentB);
}

function by_tournament(a, b) {

    var tournamentA = window.tournamentData[window.resultData[a].tournament_id],
	tournamentB = window.tournamentData[window.resultData[b].tournament_id],
	test = compareTournaments(tournamentA, tournamentB);

    return test !== 0 ? test : compareDates(tournamentA.start, tournamentB.start);
}

function by_division(a, b) {

    var resultA = window.resultData[a],
	resultB = window.resultData[b],
	test = compareDivisions(resultA, resultB);

    return test !== 0 ? test : by_date(a, b);
}

function by_place(a, b) {

    var resultA = window.resultData[a],
	resultB = window.resultData[b],
	test = resultA.place - resultB.place;

    return test !== 0 ? test : by_date(a, b);
}

function by_partner(a, b) {

    var resultA = window.resultData[a],
	resultB = window.resultData[b],
	partnerA = resultA.player1 == window.playerId ? resultA.name2 : resultA.name1,
	partnerB = resultB.player1 == window.playerId ? resultB.name2 : resultB.name1;

    return compareNames(partnerA, partnerB);
}

function compareDates(a, b) {

    var dateA = fromMysqlDate(a),
	dateB = fromMysqlDate(b);

    return dateA.getTime() - dateB.getTime();
}

function compareTournaments(a, b) {

    return a.name.localeCompare(b.name);
}

function compareDivisions(a, b) {

    return DIV_ORDER.indexOf(a.division) - DIV_ORDER.indexOf(b.division);
}

const MMM = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
    
function getShortDate(date) {

    return MMM[date.getMonth()] + ' ' + date.getFullYear();
}

const HEADERS = {
    'Place': [ 'Place', 'Finishes' ],
    'Tournament': [ 'Tournament', 'Finishes', 'Average', 'Wins' ],
    'Partner': [ 'Partner', 'Finishes', 'Average', 'Wins' ]
};

function showStats() {

    var content = $('#content'),
	resultIds = Object.keys(window.resultData),
	numTournaments = resultIds.length,
	avgFinish = Object.keys(resultData).reduce((a, b) => a + Number(resultData[b].place), 0) / numTournaments,
	html = '';

    html += '<div class="mainStat">Tournaments played: ' + numTournaments + '</div>';
    html += '<div class="mainStat">Average finish: ' + avgFinish.toFixed(2) + '</div>';
    content.append(html);

    [ 'Place', 'Tournament', 'Partner' ].forEach(function(which) {
	    let lcWhich = which.toLowerCase();
	    html = '<div class="header">' + which + '</div>';
	    html += '<table id="' + lcWhich + 'Table" class="stats"><tr>';
	    HEADERS[which].forEach(column => html += getResultHeader(column, lcWhich));
	    html += '</tr></table>';
	    content.append(html);
	    $('#' + lcWhich + 'Table th span').click(sortStats);
	    displayStatTable(lcWhich);
	});
}

function sortStats() {

    var id = $(this).closest('th').prop('id'),
	parts = id.split('_'),
	which = parts && parts[0],
        column = parts && parts[1];

    if (!which || !column) {
        return;
    }

    displayStatTable(which, column);
}

function displayStatTable(which, column) {

    column = column || which;

    var resultIds = Object.keys(window.resultData),
	table = $('#' + which + 'Table').get(0),
	sorted;

    // current sort header is underlined
    $('#' + which + 'Table span.current').removeClass('current');
    $('#' + which + '_' + column + ' span').addClass('current');

    if (which === 'place') {
	var places = {};
	resultIds.forEach(function(resultId) {
		let result = window.resultData[resultId];
		places[result.place] = places[result.place] ? places[result.place] + 1 : 1;
	    });
	
	if (column === 'place') {
	    sorted = Object.keys(places).sort((a, b) => a - b);
	}
	else if (column === 'finishes') {
	    sorted = Object.keys(places).sort((a, b) => places[b] - places[a]);
	}

	sorted.forEach(function(place, index) {
		var row = table.rows[index + 1] || table.insertRow();
		$(row).html('<td class="ddcCell">' + place + '</td><td class="ddcCell">' + places[place] + '</td>');
	    });
    }
    else if (which === 'tournament') {
	var tournaments = {},
	    tournamentWins = {},
	    tournamentTotal = {};
		
	resultIds.forEach(function(resultId) {
		let result = window.resultData[resultId],
		    name = window.tournamentData[result.tournament_id].name,
		    place = Number(result.place);
		
		tournaments[name] = tournaments[name] ? tournaments[name] + 1 : 1;
		if (result.place == 1) {
		    tournamentWins[name] = tournamentWins[name] ? tournamentWins[name] + 1 : 1;
		}
		tournamentTotal[name] = tournamentTotal[name] ? tournamentTotal[name] + place : place;
	    });

	if (column === 'tournament') {
	    sorted = Object.keys(tournaments).sort();
	}
	else if (column === 'finishes') {
	    sorted = Object.keys(tournaments).sort((a, b) => tournaments[b] - tournaments[a]);
	}
	else if (column === 'average') {
	    sorted = Object.keys(tournaments).sort((a, b) => (tournamentTotal[a] / tournaments[a]) - (tournamentTotal[b] / tournaments[b]));
	}
	else if (column === 'wins') {
	    sorted = Object.keys(tournaments).sort((a, b) => (tournamentWins[b] || 0) - (tournamentWins[a] || 0));
	}

	sorted.forEach(function(tournament, index) {
		var row = table.rows[index + 1] || table.insertRow(),
		    avgFinish = Number(tournamentTotal[tournament] / tournaments[tournament]).toFixed(2);

		var html = '<td class="ddcCell"><a href="">' + tournament + '</a></td>';
		html += '<td class="ddcCell">' + tournaments[tournament] + '</td>';
		html += '<td class="ddcCell">' + avgFinish + '</td>';
		html += '<td class="ddcCell">' + (tournamentWins[tournament] || '') + '</td>';
		$(row).html(html);
	    });

	$('#tournamentTable a').click(function(e) {
		e.preventDefault();
		showPage('results', $(this).text());
	    });
    }
    else if (which === 'partner') {
	var partners = {},
	    partnerWins = {},
	    partnerTotal = {},
	    partnerId = {};

	resultIds.forEach(function(resultId) {
		let result = window.resultData[resultId],
		    name = result.player1 == window.playerId ? result.name2 : result.name1,
		    id = result.player1 == window.playerId ? result.player2 : result.player1,
		    place = Number(result.place);
		
		name = name || '[solo]';
		partnerId[name] = id;
		partners[name] = partners[name] ? partners[name] + 1 : 1;
		if (result.place == 1) {
		    partnerWins[name] = partnerWins[name] ? partnerWins[name] + 1 : 1;
		}
		partnerTotal[name] = partnerTotal[name] ? partnerTotal[name] + place : place;
	    });

	
	if (column === 'partner') {
	    sorted = Object.keys(partners).sort();
	}
	else if (column === 'finishes') {
	    sorted = Object.keys(partners).sort((a, b) => partners[b] - partners[a]);
	}
	else if (column === 'average') {
	    sorted = Object.keys(partners).sort((a, b) => (partnerTotal[a] / partners[a]) - (partnerTotal[b] / partners[b]));
	}
	else if (column === 'wins') {
	    sorted = Object.keys(partners).sort((a, b) => (partnerWins[b] || 0) - (partnerWins[a] || 0));
	}

	sorted.forEach(function(partner, index) {
		var row = table.rows[index + 1] || table.insertRow(),
		    avgFinish = Number(partnerTotal[partner] / partners[partner]).toFixed(2);

		var html = '<td class="ddcCell"><a href="player.html?id=' + partnerId[partner] + '">' + partner + '</a></td>';
		html += '<td class="ddcCell">' + partners[partner] + '</td>';
		html += '<td class="ddcCell">' + avgFinish + '</td>';
		html += '<td class="ddcCell">' + (partnerWins[partner] || '') + '</td>';
		$(row).html(html);
	    });
    }
}
