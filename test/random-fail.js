var babysitter = require('..');
var expect = require('chai').expect;
var mlog = require('mocha-logger');
var pm2 = require('pm2');

describe('PM2-Babysitter: React to a randomly failing server', function() {

	beforeEach(function(done) {
		this.timeout(5 * 1000);

		pm2.connect(function(err) {
			if (err) return done(err);
			pm2.start({
				name: 'failing-server',
				script: __dirname + '/servers/web.js',
			}, function(err) {
				if (err) return done(err);
				setTimeout(()=> done(), 1000); // Wait until server boots. FIXME: Horrible kludge
			});
		});
	});

	afterEach(function(done) {
		babysitter.clear();
		pm2.connect(function(err) {
			if (err) return done(err);
			pm2.delete('failing-server', done);
		});
	});


	it('should monitor a randomly failing server, restarting it when it doesnt respond (GET /random-fail)', function(done) {
		this.timeout(35 * 1000);

		babysitter
			.on('check', (id, state, err) => mlog.log('Server', id, 'has state', state, err ? '(' + err + ')' : ''))
			.on('restart', (id, state) => mlog.log('Restart', id))
			.add('failing-server', babysitter.rules.get('http://localhost:8080/random-fail', 'OK!', 1000)) // Set the timeout to 500ms so we see some action
			.monitor()

		// Quit the test after 30s
		setTimeout(()=> done(), 30 * 1000);
	});

});
