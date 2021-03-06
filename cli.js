#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var asyncFlush = require('async-chainable-flush');
var babysitter = require('.');
var program = require('commander');

program
	.version(require('./package.json').version)
	.usage('-a <app(s)> -u [url] [options]')
	.option('-a, --app [apps]', 'The app or apps (seperate with commas) to monitor')
	.option('-d, --restartDelay [number]', 'Delay any restart operation by this number of MS (useful for slow boot servers')
	.option('-f, --frequency [time in ms]', 'Set the monitoring frequency (default is 1000)')
	.option('-u, --url [url]', 'Install a URL monitoring rule')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', (i, v) => v + 1, 0)
	.parse(process.argv);


async()
	.use(asyncFlush)
	// Sanity checks {{{
	.then(function(next) {
		if (!program.app) return next('App must be specified: --app [app1,app2...]');
		program.app = program.app.split(/\s*,\s*/);

		if (program.frequency && !isFinite(program.frequency)) return next('--frequency must be a valid time in milliseconds');

		if (!program.url) return next('You must specify a rule to use. Specify at least one of: --url [url]');

		next();
	})
	// }}}
	// Setup babysitter rules {{{
	.then(function(next) {
		var options = {};
		if (program.verbose) console.log('Monitor apps [' + program.app.join(',') + ']');

		var rules = [];
		// --url <url> [string] {{{
		if (program.url) {
			var segments = program.url.split(/\s+/);
			rules.push(babysitter.rules.get.apply(this, segments));
			if (program.verbose) console.log(
				' - With URL ' + segments[0] +
				(segments[1] ? ' for string "' + segments[1] + '"' : '')
			);
		}
		// }}}
		// --restartDelay [ms] {{{
		if (program.restartDelay) options.restartDelay = program.restartDelay;
		// }}}

		var monitor = babysitter
			.add(program.app, rules, options)
			.on('error', err => console.log('ERROR', err))

		if (program.frequency) monitor.frequency = program.frequency;
		if (program.verbose >= 2) monitor.on('check', (id, state) => console.log('ID', id, 'has state', state));
		if (program.verbose) monitor.on('restart', id => console.log('RESTART', id));
		if (program.verbose >= 3) monitor.on('postRestart', id => console.log('RESTARTED', id));

		monitor.monitor()

		next();
	})
	// }}}
	// End {{{
	.flush()
	.end(function(err) {
		if (program.verbose > 2) console.log('Done');
		if (err) {
			console.log('ERROR', err.toString());
			return process.exit(1);
		} else {
			// NOTE: Don't ever exit as the monitor will have been installed
		}
	});
	// }}}
