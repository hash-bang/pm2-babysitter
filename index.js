var _ = require('lodash');
var async = require('async-chainable');
var events = require('events');
var pm2 = require('pm2');
var superagent = require('superagent');
var util = require('util');

function Babysitter() {
	var babysitter = this;

	// Pre-defined babysitter.rules setup {{{

	/**
	* Pre-defined rules available to quickly setup babysitter behaviour
	* Each defined rule should return a function which acts as a validator for behaviour
	* @var {array}
	*/
	babysitter.rules = {
		/**
		* Basic HTTP fetcher
		* Will probe a given URL and optionally check against a string, RegExp or arrays of the same
		* @param {string} url The URL to probe
		* @param {string|regexp|array} A single string, RegExp or arrays of teh same that must be satisfied
		* @param {number} [timeout=5000] Timeout in ms before giving up
		* @return {function} The validator function
		*/
		get: (url, strings, timeout) => function(cb) {
			var hasTimedout = false;
			var timeoutHandler = setTimeout(function() {
				hasTimedout = true;
				cb('Timed out');
			}, timeout || 5000);

			superagent.get(url)
				.timeout(timeout || 5000)
				.end(function(err, res) {
					if (hasTimedout) return;
					clearTimeout(timeoutHandler);
					if (err) return cb(err);
					if (err && err.timeout) return cb('Timed out');
					if (res.statusCode != 200) return cb('Status Code = ' + res.statusCode);
					if (strings) {
						async()
							.forEach(_.castArray(strings), function(next, validator) {
								if (_.isFunction(validator)) {
									validator(next, res);
								} else if (_.isString(validator)) {
									next(res.text.indexOf(validator) === false ? 'Failed to find required string: "' + validator + '"' : null);
								} else if (_.isRegExp(validator)) {
									next(!validator.test(res.text) ? 'Failed to find required RegExp: "' + validator.toString() + '"' : null);
								}
							})
							.end(cb);
					} else {
						cb();
					}
				});
		},
	};
	// }}}

	/**
	* How often to run the watching method in ms if babysitter.monitor() is called
	* @see monitor()
	* @var {number}
	*/
	babysitter.frequency = 1000;


	/**
	* Collection of each watch thats installed
	* Each item should be an object containing: id, apps, ruleset
	* ID will be either the process if there is only one or randomly generated
	* @var {array}
	*/
	babysitter.watches = [];


	/**
	* Next unique ID allocation
	* Used when allocating a unique ID to a multiple process watcher
	* @access private
	* @var {number}
	*/
	babysitter.nextId = 0;


	/**
	* Add a watch rule
	* @param {string|array} process The PM2 process name(s) to reboot if the ruleset fails
	* @param {function|array|string} ruleset Either single callback function or an array of callbacks, all of which must validate to satisfy the watcher. If this is a string the form `babysitter.rules.get(STRING)` is assumed as a shorthand
	* @param {string} [action="restart"] Action to take if any rule fails. ENUM: 'none', 'restart'
	* @param {Object} [options] Other options to accept
	* @param {number} [options.restartDelay] How long to wait between restarts
	* @emits add Fired with the new watch rule added
	* @return {Babysitter} This chainable object
	*/
	babysitter.add = function(process, ruleset, action, options) {
		// Function option mangling {{{
		if (_.isString(ruleset)) { // Mutate ruleset into the shorthand style if passed a string
			ruleset = babysitter.rules.get(ruleset);
		}

		if (_.isObject(action)) { // If action is an object assume its omitted
			options = action;
			action = 'restart';
		}
		// }}}

		var newWatcher = {
			apps: _.castArray(process),
			ruleset: _.castArray(ruleset),
			action: action || 'restart',
		};
		if (_.isObject(options)) _.merge(newWatcher, options); // Merge misc options

		newWatcher.id = newWatcher.apps.length == 1 ? newWatcher.apps[0] : 'babysitter-' + babysitter.nextId++;

		babysitter.watches.push(newWatcher);

		babysitter.emit('add', newWatcher);

		return babysitter;
	};


	/**
	* Remove all watchers
	* @return {Babysitter} This chainable object
	*/
	babysitter.clear = function() {
		babysitter.watches = [];
		babysitter.removeAllListeners();
		return babysitter;
	};


	// .cycle() functionality {{{
	/**
	* Perform one cycle check
	* @param {function} [cb] Optional callback to fire when completed, with any errors that occured
	* @emits preCycle Indicator that we are about to do a cycle check
	* @emits check Post check for a a single watcher. Called with the ID, the state (boolean) and an optional error message
	* @return {Babysitter} This chainable object
	*/
	babysitter.cycle = function(cb) {
		babysitter.emit('preCycle');

		async()
			.forEach(babysitter.watches, function(nextWatcher, watcher) {
				async()
					.forEach(watcher.ruleset, function(next, rule) {
						rule(next);
					})
					.end(function(err) {
						if (err) {
							babysitter.emit('check', watcher.id, false, err);
							babysitter.wakeChild(nextWatcher, watcher);
						} else {
							babysitter.emit('check', watcher.id, true);
							nextWatcher();
						}
					});
			})
			.end(cb);
	};


	/**
	* Performs whatever action is configured against a watcher if any of the rules fail
	* @emits error Any error message that could occur (e.g. by telling PM2 to restart the app)
	*/
	babysitter.wakeChild = function(cb, watcher) {
		switch (watcher.action) {
			case 'none': return cb();
			case 'restart':
				async()
					.then('pm2', function(next) {
						pm2.connect(next);
					})
					// Check for restart delay and abort if its within the tolerence {{{
					.set('stillRestarting', 0)
					.forEach(watcher.apps, function(nextApp, app) {
						if (!watcher.restartDelay) return nextApp(); // No restartDelay specified
						pm2.describe(app, (err, proc) => {
							if (err) return nextApp(err);
							var age = Date.now() - proc[0]['pm2_env']['pm_uptime'];
							if (age < watcher.restartDelay) this.stillRestarting++;
							nextApp();
						});
					})
					.then(function(next) {
						if (this.stillRestarting > 0) {
							return next('WITHIN-DELAY');
						} else {
							next();
						}
					})
					// }}}
					.then(function(next) {
						babysitter.emit('restart', watcher.id);
						next();
					})
					.forEach(watcher.apps, function(next, app) {
						pm2.restart(app, next);
					})
					.end(function(err) {
						if (err && err == 'WITHIN-DELAY') {
							babysitter.emit('restartDelay', 'App is still rebooting "' + watcher.apps.join(', '));
						} else if (err) {
							babysitter.emit('error', 'Error rebooting app "' + watcher.apps.join(', ') + '" - ' + err.toString());
						}
						babysitter.emit('postRestart', watcher.id);
						cb();
					});
				break;
			default:
				throw new Error('Unknown watcher action: ' + watcher.action);
		}
	};
	// }}}

	// .monitor() functionality {{{
	/**
	* The handle to the setTimeout reference installed by monitor()
	* @access private
	* @var {Object}
	*/
	babysitter._monitorHandle;


	/**
	* Run a single monitor cycle and reschedule the next
	* This function really just calls cycle() with some surrounding fluff to rescheule the next check
	*/
	babysitter._monitorCycle = function() {
		clearTimeout(babysitter._monitorHandle); // Wipe existing timers if we were called manually

		babysitter.cycle(function() {
			babysitter._monitorHandle = setTimeout(babysitter._monitorCycle, babysitter.frequency);
		});
	};


	/**
	* Periodically page each watcher to validate it is up
	* If the montitor is already installed this function will exit
	* @return {Babysitter} This chainable object
	*/
	babysitter.monitor = function() {
		if (babysitter._monitorHandle) return babysitter;

		babysitter._monitorHandle = setTimeout(babysitter._monitorCycle, babysitter.frequency);

		return babysitter;
	};
	// }}}

	return babysitter;
}

util.inherits(Babysitter, events.EventEmitter);

module.exports = new Babysitter();
