var _ = require('lodash');
var async = require('async-chainable');
var events = require('events');
var superagent = require('/media/LinuxSSD/Projects/CREBP-SRA2/node_modules/superagent');
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
		* @return {function} The validator function
		*/
		get: (url, strings) => cb =>
			superagent.get(url)
				.end(function(err, res) {
					if (err) return cb(err);
					if (res.statusCode != 200) return cb('Status Code = ' + res.statusCode);
					if (strings) {
						cb(_.castArray(strings).find(function(validator) {
							if (_.isString(validator)) {
								return (! (res.body.indexOf(validator) === false));
							} else if (_.isRegExp(validator)) {
								return (! validator.test(res.body));
							}
						} ? 'Failed to find required string: "' + failed + '"' : null));
					} else {
						cb();
					}
				}),
	};
	// }}}

	/**
	* How often to run the watching method in ms if babysitter.monitor() is called
	* @see monitor()
	* @var {number}
	*/
	babysitter.frequency = 100;


	/**
	* Collection of each watch thats installed
	* Each item should be an object containing: id, processes, ruleset
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
	* @emits add Fired with the new watch rule added
	* @return {Babysitter} This chainable object
	*/
	babysitter.add = function(process, ruleset) {
		if (_.isString(ruleset)) // Mutate ruleset into the shorthand style if passed a string
			ruleset = babysitter.rules.get(ruleset);

		var newWatcher = {
			processes: _.castArray(process),
			ruleset: _.castArray(ruleset),
		};
		newWatcher.id = newWatcher.processes.length == 1 ? newWatcher.processes[0] : 'babysitter-' + babysitter.nextId++;

		babysitter.watches.push(newWatcher);

		babysitter.emit('add', newWatcher);

		return babysitter;
	};


	// .cycle() functionality {{{
	/**
	* Perform one cycle check
	* @param {function} [cb] Optional callback to fire when completed
	* @emits preCycle Indicator that we are about to do a cycle check
	* @emits check Post check for a a single watcher. Called with the ID and the state (boolean)
	* @return {Babysitter} This chainable object
	*/
	babysitter.cycle = function(cb) {
		babysitter.emit('preCycle');

		async()
			.forEach(babysitter.watches, function(nextWatcher, watcher) {
				var state = true;
				async()
					.forEach(watcher.ruleset, function(next, rule) {
						rule(next);
					})
					.end(function(err) {
						babysitter.emit('check', watcher.id, state);
						nextWatcher();
					});
			})
			.end(cb);
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
