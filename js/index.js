function initializeIndex() {

    $('.pageLink').click(pageLinkClicked);
    showPage('byYear');
}

function showPage(page) {

    $('#content').html('');

    // current selection is underlined
    $('#' + window.curPage).removeClass('current');
    $('#' + page).addClass('current');

    switch(page) {

    case 'byYear': {
	showResultsByYear();
	break;
    }
 
    case 'byName': {
	showResultsByName();
	break;
    }

    case 'rankings': {
	window.location = "/results/rankings.html";
	break;
    }

    case 'champions': {
	window.location = "/results/champs.html";
	break;
    }

    }

    window.curPage = page;
}

function showResultsByYear() {

    sendRequest('load-tournament', { sortBy: 'start DESC' }, gotResultsByYear);
}

function gotResultsByYear(data) {

    if (!data) {
	return;
    }

    var html = '',
	curYear = 0;

    data.forEach(function(tournament) {
	    var year = tournament.start.substr(0, 4);
	    if (year != curYear) {
		html += "<div class='header'>" + year + "</div>";
		curYear = year;
	    }
	    html += "<div class='tournament'><a href='tournament.html?id=" + tournament.id + "'>" + tournament.name + "</a></div>";
	});

    $('#content').append(html);
}

function showResultsByName() {

    sendRequest('load-tournament', { sortBy: 'name,start DESC' }, gotResultsByName);
}

function gotResultsByName(data) {

    if (!data) {
	return;
    }

    var html = '<table>',
	curName = '';

    data.forEach(function(tournament) {
	    var year = tournament.start.substr(0, 4);
	    if (tournament.name != curName) {
		if (curName) {
		    html += "</tr>";
		}
		html += "<tr>";
		html += "<td class='tournament'>" + tournament.name + "</td>";
		html += "<td class='year'><a href='tournament.html?id=" + tournament.id + "'>" + year + "</a></td>";
		curName = tournament.name;
	    }
	    else {
		html += "<td class='year'><a href='tournament.html?id=" + tournament.id + "'>" + year + "</a></td>";
	    }
	});

    html += '</tr></table>';

    $('#content').append(html);
}

