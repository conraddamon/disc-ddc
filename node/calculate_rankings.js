/*
 * This script calculates current or historical rankings. For historical rankings, provide the argument 'all'.
 * Existing rankings in the database are deleted first.
 */

// if true, do not write to database
const DEBUG = false;

let rankings = require('./rankings.js');

// from https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
const promiseSerial = funcs =>
    funcs.reduce((promise, func) =>
		 promise.then(result => func().then(Array.prototype.concat.bind(result))),
		 Promise.resolve([]));

let args = process.argv.slice(2),
    all = args.indexOf('all') !== -1,
    bonus = args.indexOf('bonus') !== -1,
    rewrite = args.indexOf('rewrite') !== -1,
    debug = DEBUG || args.indexOf('debug') !== -1,
    funcs = [];

let order = all ? 'ASC' : 'DESC',
    query = "SELECT end FROM tournament ORDER BY end " + order + " LIMIT 1",
    end;

// first, figure out the time period we need results from
rankings.dbQuery(query)
    .then(function(data) {
	end = rankings.toMysqlDate(data[0].end);
	// delete existing rankings
	return rewrite ? deleteRecords(end, all) : Promise.resolve();
    })
    .then(function() {
	// historical rankings
	if (all) {
	    let firstYear = end.substr(0, 4),
		curYear = (new Date()).getFullYear();
	    
	    // create a list of functions that will generate rankings
	    for (let year = firstYear; year < curYear; year++) {
		funcs.push(rankings.calculateRankings.bind(null, year + '-12-31', { bonus: bonus }));
	    }
			
	    // invoke the functions
	    promiseSerial(funcs).then(function() {
		    rankings.db.end();
		});
	}
	// current rankings
	else {
	    let promises = [];
	    promises.push(rankings.calculateRankings(end, { bonus: bonus, debug: debug }));
	    Promise.all(promises).then(function() {
		    rankings.db.end();
		});
	}
    });


/*
 * Delete either current or all rankings
 */
function deleteRecords(date, all) {

    date = rankings.quote(date);
    let query = "DELETE * FROM ranking WHERE ";
    query += all ? "date < " + date : "date = " + date;

    return rankings.dbQuery(query);
}