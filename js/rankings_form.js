function initializeRankingsForm() {

    $('#submitButton').click(submitForm);
}

function submitForm(e) {

    e.preventDefault();

    $('#content').html('<div class="waiting">Calculating rankings ...</div>');

    let options = {};
    options.pointBase = {};
    $('input').each(function() {
	    let id = this.id,
		value = $('#' + id).val();

	    if (id.indexOf('base') === 0) {
		let level = id.substr(4);
		options.pointBase[level] = value;
	    }
	    options[id] = value;
	});
    
    generateRankings(options).then(function(points) {

	    let rankings = {};
	    let divs = Object.keys(points).sort((a, b) => DIV_ORDER.indexOf(a) - DIV_ORDER.indexOf(b));
	    divs.forEach(function(div) {
		    let players = Object.keys(points[div]),
			curPoints, rank;

		    players.sort((a, b) => points[div][b] - points[div][a]);
		    players.forEach(function(p, idx) {
			    let pts = points[div][p].toFixed(2);
			    if (pts != curPoints) {
				rank = idx + 1;
			    }
			    rankings[div] = rankings[div] || {};
			    rankings[div][p] = {
				points: pts,
				rank: rank
			    };
			});
		});

	    sendRequest('load-player').then(function(data) {
		    data = JSON.parse(data);
		    let names = {};
		    data.forEach(p => names[p.id] = p.name);
		    showRankings(rankings, names);
		});
	});;
}
