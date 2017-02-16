var babysitter = require('..');
var expect = require('chai').expect;
var pm2 = require('pm2');

describe('PM2-Babysitter: Basic HTTP test', function() {

	beforeEach(function(done) {
		this.timeout(5 * 1000);

		pm2.connect(function(err) {
			if (err) return done(err);
			pm2.start({
				name: 'web',
				script: __dirname + '/servers/web.js',
			}, function(err) {
				if (err) return done(err);
				setTimeout(()=> done(), 1000); // Wait until server boots. FIXME: Horrible kludge
			});
		});
	});

	afterEach(function(done) {
		babysitter.clear();
		pm2.stop('web', done);
	});


	// Shorthand method {{{
	it('should monitor the web process using the shorthand add method (GET /)', function(done) {
		var status = [];

		babysitter
			.on('check', (id, state) => status.push({id: id, state: state}))
			.add('web', 'http://localhost:8080')
			.cycle(function() {
				expect(status).to.be.deep.equal([
					{id: 'web', state: true},
				]);
				done();
			})
	});


	it('should monitor the web process using the shorthand add method and fail (GET /fail)', function(done) {
		var status = [];

		babysitter
			.on('check', (id, state) => status.push({id: id, state: state}))
			.add('web', 'http://localhost:8080/fail')
			.cycle(function() {
				expect(status).to.be.deep.equal([
					{id: 'web', state: false},
				]);
				done();
			})
	});
	// }}}

	// Longhand method {{{
	it('should monitor the web process using the longhand method', function(done) {
		var status = [];

		babysitter
			.on('check', (id, state) => status.push({id: id, state: state}))
			.add('web', [
				babysitter.rules.get('http://localhost:8080', 'Hello World'),
			])
			.cycle(function() {
				expect(status).to.be.deep.equal([
					{id: 'web', state: true},
				]);
				done();
			})
	});

	it('should monitor the web process using the longhand method (and fail on a wrong RegExp)', function(done) {
		var status = [];

		babysitter
			.on('check', (id, state) => status.push({id: id, state: state}))
			.add('web', [
				babysitter.rules.get('http://localhost:8080', /NOPE/),
			])
			.cycle(function() {
				expect(status).to.be.deep.equal([
					{id: 'web', state: false},
				]);
				done();
			})
	});
	// }}}

	// JSON validation {{{
	it('should monitor the web process and validate against JSON', function(done) {
		var status = [];

		babysitter
			.on('check', (id, state) => status.push({id: id, state: state}))
			.add('web', [
				babysitter.rules.get('http://localhost:8080/json', function(next, res) {
					expect(res.body).to.have.property('foo', 1);
					expect(res.body).to.have.property('bar', 'Bar!');
					expect(res.body).to.have.property('baz', 'BazBazBaz');
					next();
				}),
			])
			.cycle(function(err) {
				expect(status).to.be.deep.equal([
					{id: 'web', state: true},
				]);
				done();
			})
	});

	it('should monitor the web process and validate against JSON (and fail on a wrong RegExp)', function(done) {
		var status = [];

		babysitter
			.on('check', (id, state) => status.push({id: id, state: state}))
			.add('web', [
				babysitter.rules.get('http://localhost:8080', /NOPE/),
			])
			.cycle(function() {
				expect(status).to.be.deep.equal([
					{id: 'web', state: false},
				]);
				done();
			})
	});
	// }}}
});
