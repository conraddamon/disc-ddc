/*
 * This script calculates current or historical rankings. For historical rankings, provide the argument 'all'.
 * Existing rankings in the database are deleted first.
 */

// if true, do not write to database
const TEST = false;

let rankings = require('./rankings.js');

let args = process.argv.slice(2),
    options = {};

options.save = true; // save results to db
options.all = args.indexOf('all') !== -1;
options.sweden = args.indexOf('sweden') !== -1;
options.test = TEST || args.indexOf('test') !== -1;

rankings.generateRankings(options);
