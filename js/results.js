const REQUIRED = [ 'name', 'location', 'start', 'end' ];

/**
 * Sets up key handlers, adds a date picker, and sets up form submission.
 */
function initializeResults() {

    // handle Enter key
    $(':text').on('keypress keydown keyup', keyHandler);
    $('#playerData').on('keypress keydown keyup', keyHandler);

    // hide results header to start
    $('#playerDataHeader').hide();

    // use jQuery's mini-calendar
    $('#start,#end').datepicker({
            dateFormat: "M d, yy"
	});

    $('#divisionSelect').change(function(e) {
	    $('#resultsDivision').text(DIV_NAME[$('#divisionSelect').val()]);
	    $('#place').val(1);
	});

    // we handle form submit
    $('#submitButton').click(submitResults);

    // fetch data
    sendRequest('load-player', null, function(data) {
	    saveNames(data);
	    addNameAutocomplete(getNameList(data), null, null, null, 'player1');
	    addNameAutocomplete(getNameList(data), null, null, null, 'player2');
	});
}

/**
 * Handles use of the Enter key. If it happens in the Score field, we add a row for the player.
 * If it happens in a prize money box, we update the total.
 *
 * @param {Event} e    Browser event
 */
function keyHandler(e) {

    if (e.keyCode === 13) {
        if (e.type === 'keyup') {
            if (e.target.id === 'place') {
                addPlace();
            }
            else if (e.target.id === 'player1') {
                $('#player2').focus();
            }
            else if (e.target.id === 'player2') {
                $('#place').focus();
            }
        }
        e.preventDefault();
    }
}

/**
 * Starts the process of adding a result data row to the table. If any players are new, add them.
 */
function addPlace() {

    var player1 = $('#player1').val(),
	player2 = $('#player2').val(),
	team = [ player1, player2 ],
        place = $('#place').val();

    if (!$.isNumeric(place)) {
        return;
    }

    var newPlayers = team.filter(p => p && !window.personId[p]);
    if (newPlayers.length > 0) {
        addPlayers(newPlayers, team, place);
    }
    else {
        showPlace(team, place);
    }
}

/**
 * Adds one or two players to the database.
 *
 * @param {array}    players     player names to add to DB
 * @param {array}    team        one or two player names
 * @param {int}      place       team finish
 */
function addPlayers(players, team, place) {

    var requests = [],
	callbacks = [],
	division = $('#divisionSelect').val(),
	isWomensDivision = division.toLowerCase().indexOf('w') !== -1;

    players.forEach(function(player) {
	    if (player) {
		requests.push(sendRequest('add-player', { name: player, sex: isWomensDivision ? 'female' : 'male' }));
		callbacks.push(handlePlayerAdd.bind(null, player));
	    }
	});

    sendRequests(requests, callbacks).then(showPlace.bind(null, team, place));
}

function handlePlayerAdd(player, playerId) {

    window.personData[playerId] = { name: player };
    window.personId[player] = playerId;
}

/**
 * Adds a result row to the table.
 *
 * @param {array}   team       one or two player names
 * @param {int}     place      finishing rank
 */
function showPlace(team, place) {

    // update data
    team.forEach(p => {
	    let pd = p && window.personData[window.personId[p]];
	    if (pd) {
		pd.place = place;
	    }
	});

    // show the header
    $('#resultsHeader').show();

    // add a row to the list of results
    addResultRow(team, place);

    // reset form fields
    $('#player1').val('');
    $('#player2').val('');
    $('#place').val(Number(place) + 1);
    $('#player1').focus();
}

/**
 * Adds a result in order of place.
 *
 * @param {array}   team       one or two player names
 * @param {int}     place      finishing rank
 */
function addResultRow(team, place) {

    var idAttrs = team.map(function(player, index) {
	    var id = player && window.personId[player];
	    return id ? 'data-player' + (index + 1) + "id='" + id + "'": '';
	});

    var div = $('#divisionSelect').val(),
	divOrder = DIV_ORDER.indexOf(div);

    var html = "<div " + idAttrs.join(' ') + "><div class='dataCell divCol'>" + div + "</div><div class='dataCell placeCol'>" + place + "</div>";
    html += "<div class='dataCell teamCol'>" + (team.length > 1 ? team.join(' / ') : team[0]) + "</div>";
    html += "<div class='dataCell deleteCol imgTrash' onclick='removeRow(event);'></div></div>";

    var index = -1;
    $('div[data-player1id]').each(function(idx, el) {
	    var d = $(el).children('.divCol').text(),
		divDiff = divOrder - DIV_ORDER.indexOf(d),
		pl = $(el).children('.placeCol').text();

	    var refX = (divOrder * 100) + Number(place),
		curX = (DIV_ORDER.indexOf(d) * 100) + Number(pl);

	    if (curX > refX) {
		index = idx;
		return false;
	    }
	});

    // insert row at sort index - why doesn't jquery have insert at index?
    if (index === 0) {
	$('#resultData').prepend(html);
    }
    else if (index === -1) {
	$('#resultData').append(html);
    }
    else {
	$('#resultData').children().eq(index - 1).after(html);
    }
}

/**
 * Removes the row containing the clicked trash icon.
 *
 * @param {Event} e    Browser event
 */
function removeRow(e) {

    $(e.target).parent().remove();
}

/**
 * Sends the form with all the weekly info and round results to the server.
 *
 * @param {Event} e    Browser event
 */
function submitResults(e) {

    e.preventDefault();

    // Error checking
    var error = '';
    REQUIRED.forEach(function(field) {
	    if (!$('#' + field).val()) {
		error = 'Missing required field.';
		return;
	    }
	});
    if (error) {
	alert("Error: " + error);
	return;
    }

    var params = {
	name:     $('#name').val(),
	location: $('#location').val(),
	format:   $('input:radio[name="format"]:checked').val(),
	level:    $('input:radio[name="level"]:checked').val(),
	tags:     $('input:checkbox[name="tags"]:checked').map(function(){return this.value;}).get().join(','),
	start:    $('#start').val(),
	end:      $('#end').val(),
	note:     $('#note').val()
    };


    sendRequest('add-tournament', params).then(function(id) {
	    var requests = [];
	    id = id.replace(/['"]/g, '');
	    $('#resultData').children().each(function(idx, el) {
		    params = {
			tournamentId: id,
			division: $(el).find('.divCol').text(),
			player1: $(el).data('player1id'),
			player2: $(el).data('player2id') || 0,
			place: $(el).find('.placeCol').text()
		    }
		    requests.push(sendRequest('add-result', params));
		});
	    sendRequests(requests).then(function() {
		    window.location = "../tournament.html?id=" + id;
		});
    	});
}
