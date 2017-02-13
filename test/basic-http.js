var babysitter = require('..');
var expect = require('chai').expect;
var pm2 = require('pm2');

describe('PM2-Babysitter: Basic HTTP test', function() {

	beforeEach(function(done) {
		pm2.connect(function(err) {
			if (err) return done(err);
			pm2.start({
				name: 'web',
				script: __dirname + '/servers/web.js',
			}, done);
		});
	});

	afterEach(function(done) {
		pm2.stop('web', done);
	});


	it('should monitor the web process using the shorthand add method', function(done) {
		var status = [];

		babysitter
			.on('check', (id, state) => status.push({id: id, state: state}))
			.add('web', 'http://localhost')
			.cycle(function() {
				expect(status).to.be.deep.equal([
					{id: 'web', state: true},
				]);
				done();
			})
	});

});
