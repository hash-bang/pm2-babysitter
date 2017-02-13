/**
* Basic web server
* Will respond to requests to root (http://localhost:8080) with 'Hello World'
*/

var port = 8080;
var host = 'localhost';

var express = require('express');
var app = express();

app.get('/', (req, res) => res.send('Hello World'));


var server = app.listen(port, host);
