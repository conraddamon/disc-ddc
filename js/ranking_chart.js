function initializeRankingChart() {

    // Load the Visualization API and the corechart package.
    google.charts.load('current', {'packages':['corechart']});

    // Set a callback to run when the Google Visualization API is loaded.
    google.charts.setOnLoadCallback(getPlayer);
}

function getPlayer() {
    
    let qs = parseQueryString(),
	pid = qs.id;

    sendRequest('get-player', { id: pid }).then(drawChart.bind(null, qs.div));
}

// Callback that creates and populates a data table,
// instantiates the pie chart, passes in the data and
// draws it.
function drawChart(div, data) {

    let player = JSON.parse(data)[0];
    div = div || (player.sex === 'female' ? 'W' : 'O');
    sendRequest('get-rankings', { player: player.id }).then(function(rankData) {
            rankData = JSON.parse(rankData);
	    let chartData = rankData.filter(row => row.division === div).map(row => [ row.date.substr(0, 4), Number(row.rank) ]);

	    // Create the data table.
	    chartData.unshift([ 'Year', 'Rank' ]);
	    var data = new google.visualization.arrayToDataTable(chartData);
    
	    // Set chart options
	    var options = { title: 'Ranking History for ' + player.name + ' (' + DIV_NAME[div] + ')',
			    height: 1200,
			    vAxis: { direction: -1, minValue: 1 },
			    legend: { position: 'none' }
	    };
    
	    // Instantiate and draw our chart, passing in some options.
	    var chart = new google.visualization.LineChart(document.getElementById('chart_div'));
	    chart.draw(data, options);
	});
}
