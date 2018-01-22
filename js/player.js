DIV_NAME['MX'] = 'Mixed';
DIV_ORDER.push('MX');

function initializePlayer(playerId) {

    window.playerId = playerId;

    $('.pageLink').click(pageLinkClicked);

    var getResults = sendRequest('get-results', { playerId: playerId }),
	getTournaments = sendRequest('load-tournament');

    var requests = [ getResults, getTournaments ],
	callbacks = [ gotResults, gotTournaments ];

    sendRequests(requests, callbacks).then(showPage.bind(null, 'results'));
}

function gotResults(data) {

    window.resultData = {};
    data.forEach(result => window.resultData[result.id] = result);
}

function gotTournaments(data) {

    window.tournamentData = {};
    data.forEach(tournament => window.tournamentData[tournament.id] = tournament);
}

function showPage(page) {

    $('#content').html('');

    switch(page) {

    case 'results': {
	showResults();
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

function showResults() {

    $('#content').append('<table class="resultsTable" id="resultsTable"></table>');

    var html = '<tr>';
    [ 'Date', 'Tournament', 'Division', 'Place', 'Partner' ].forEach(column => html += getResultHeader(column));
    html += '</tr>';
    $('#resultsTable').append(html);

    displayResults();

    $('#resultsTable th span').click(sortResults);
}

function getResultHeader(column) {

    return '<th class="ddcHeader" id="result_' + column.toLowerCase() + '"><span class="pageLink">' + column + '</span></th>';
}

function sortResults(e) {

    var id = $(this).closest('th').prop('id'),
        column = id.replace('result_', '');

    if (!column) {
        return;
    }

    displayResults(column);
}

function displayResults(column='date') {

    var resultIds = Object.keys(window.resultData);

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

function showStats() {

    var content = $('#content');

    var resultIds = Object.keys(window.resultData),
	places = {},
	total = 0;

    resultIds.forEach(function(resultId) {
	    let result = window.resultData[resultId];
	    places[result.place] = places[result.place] ? places[result.place] + 1 : 1;
	    total = total + Number(result.place);
	});
    
    var html = '<table class="stats"><tr><th class="ddcHeader">Place</th><th class="ddcHeader">Finishes</th></tr>',
	sorted = Object.keys(places).sort((a, b) => a - b);

    sorted.forEach(place => html += '<tr><td class="ddcCell">' + place + '</td><td class="ddcCell">' + places[place] + '</td></tr>');
    html += '</table>';

    var numTournaments = resultIds.length,
	avgFinish = Number(total / numTournaments).toFixed(2);

    content.append('<div class="mainStat">Tournaments played: ' + numTournaments + '<\div>');
    content.append('<div class="mainStat">Average finish: ' + avgFinish + '<\div>');

    content.append('<div class="header">Place</div>');
    content.append(html);

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

    var html = '<table class="stats"><tr><th class="ddcHeader">Tournament</th><th class="ddcHeader">Finishes</th><th class="ddcHeader">Average Finish</th><th class="ddcHeader">Wins</th></tr>',
    sorted = Object.keys(tournaments).sort();

    sorted.forEach(function(tournament) {
	    var avgFinish = Number(tournamentTotal[tournament] / tournaments[tournament]).toFixed(2);
	    html += '<tr>';
	    html += '<td class="ddcCell">' + tournament + '</td>';
	    html += '<td class="ddcCell">' + tournaments[tournament] + '</td>';
	    html += '<td class="ddcCell">' + avgFinish + '</td>';
	    html += '<td class="ddcCell">' + (tournamentWins[tournament] || '') + '</td>';
	    html += '</tr>';
	});
    html += '</table>';

    content.append('<div class="header">Tournament</div>');
    content.append(html);

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

    var html = '<table class="stats"><tr><th class="ddcHeader">Partner</th><th class="ddcHeader">Finishes</th><th class="ddcHeader">Average Finish</th><th class="ddcHeader">Wins</th></tr>',
    sorted = Object.keys(partners).sort(compareNames);

    sorted.forEach(function(partner) {
	    var avgFinish = Number(partnerTotal[partner] / partners[partner]).toFixed(2);
	    html += '<tr>';
	    html += '<td class="ddcCell"><a href="player.html?id=' + partnerId[partner] + '">' + partner + '</a></td>';
	    html += '<td class="ddcCell">' + partners[partner] + '</td>';
	    html += '<td class="ddcCell">' + avgFinish + '</td>';
	    html += '<td class="ddcCell">' + (partnerWins[partner] || '') + '</td>';
	    html += '</tr>';
	});
    html += '</table>';

    content.append('<div class="header">Partner</div>');
    content.append(html);
}
