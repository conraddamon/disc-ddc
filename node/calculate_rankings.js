/*
 * This script calculates current or historical rankings. For historical rankings, provide the argument 'all'.
 * Existing rankings in the database are deleted first.
 */

let rankings = require('./rankings.js');

// from https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
const promiseSerial = funcs =>
    funcs.reduce((promise, func) =>
		 promise.then(result => func().then(Array.prototype.concat.bind(result))),
		 Promise.resolve([]));

let args = process.argv.slice(2),
    all = args[0] === 'all',
    order = all ? 'ASC' : 'DESC',
    query = "SELECT end FROM tournament ORDER BY end " + order + " LIMIT 1",
    funcs = [];

// first, figure out the time period we need results from
rankings.db.query(query, function(error, data) {
	let end = rankings.toMysqlDate(data[0].end);
	// delete existing rankings
	deleteRecords(end, all).then(function() {
		// historical rankings
		if (all) {
		    let firstYear = end.substr(0, 4),
			curYear = (new Date()).getFullYear();

		    // create a list of functions that will generate rankings
		    for (let year = firstYear; year < curYear; year++) {
			funcs.push(rankings.calculateRankings.bind(null, year + '-12-31'));
		    }
	    
		    // invoke the functions
		    promiseSerial(funcs).then(function() {
			    rankings.db.end();
			});
		}
		// current rankings
		else {
		    rankings.calculateRankings(end).then(function() {
			    rankings.db.end();
			});
		}
	    });
    });

/*
 * Delete either current or all rankings
 */
function deleteRecords(date, all) {

    return new Promise(function(resolve, reject) {
	    date = rankings.quote(date);
	    let query = "DELETE * FROM ranking WHERE ";
	    query += all ? "date < " + date : "date = " + date;
	    console.log(query);
	    rankings.db.query(function(error, data) {
		    resolve();
		});
    });
}