/**
* Basic web server
* Will respond to requests to root (http://localhost:8080) with 'Hello World'
*/

var port = 8080;
var host = 'localhost';

var express = require('express');
var app = express();

app.get('/', (req, res) => res.send('Hello World'));

app.get('/fail', function(req, res) {
	res.status(500).send('Fail!');
});

app.get('/random-fail', function(req, res) {
	var diceRoll = Math.ceil(Math.random() * 10);
	if (diceRoll == 7 || diceRoll == 8) { // Err with 500 (2/10 chance)
		console.log('Respond with 500');
		res.status(500).send('Random Fail!');
	} else if (diceRoll == 9) { // Timeout due to thread leak (1/10 chance)
		console.log('Thread leak!');
		// Do nothing
	} else { // Respond without issue (3/10 chance)
		console.log('Respond with 200');
		res.send('OK!');
	}
});

app.get('/leak', function (req, res) {
	// NOTE: Intentional process leak - this will never call any of the res.send() callbacks
});

app.get('/json', function(req, res) {
	res.send({
		time: Date.now(),
		foo: 1,
		bar: 'Bar!',
		baz: 'BazBazBaz',
	});
});


var server = app.listen(port, host);
