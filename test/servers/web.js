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

app.get('/leak', function (req, res) {
	// NOTE: Intentional process leak - this will never call any of the res.send() callbacks
});

app.get('/json', function(req, res) {
	res.send({
		time: Date.now(),
		foo: 1,
		bar: 20,
		baz: 30,
	});
});


var server = app.listen(port, host);
