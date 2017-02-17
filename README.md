PM2-Babysitter
==============
Oversight to PM2 which will reboot servers based on a ruleset.

In its simplest form this module will ensure that primary apps will be rebooted when they stop responding.

In a more complex form: an advanced ruleset can be defined to restart a PM2 app structure if something goes horribly wrong.


PM2-Babysitter can be used in three separate ways:

1. Via an [API](#api-example)
2. Directly via the [Command Line](#cli-example)
3. Within [PM2 itself](#pm2-example) (Recommended)


API Example
-----------

```javascript
var babysitter = require('pm2-babysitter');

// Just watch this app and reboot it if port 80 stops responding. This invokation is actually shorthand for the below
babysitter.add('my-pm2-app', 'http://localhost');


// Full version of the above
babysitter.add('my-pm2-app', [
	babysitter.rules.get('http://localhost'),
]);


// More detailed version of the above which also checks for a string (or a RegExp if given one)
babysitter.add('my-pm2-app', [
	babysitter.rules.get('http://localhost', 'Hello World'),
]);


// Expect a JSON response from a given URL and validate that it has 'foo.bar.baz'
babysitter.add('my-pm2-app', [
	babysitter.rules.get('http://localhost', function(cb, res) {
		// Perform JSON validation or any other kind of response verification here
		if (_.has(res.body, 'foo.bar.baz')) return cb('Invalid response');
		cb();
	}),
]);
```


CLI Example
-----------
The below example runs pm2-babysitter directly from the command line. It is recommended that you use the PM2 method (below) instead as that can be monitored by PM2 itself.

```
// Run pm2-babysitter to monitor to the app 'my-pm2-app' and restart it if 'http://localhost' stops responding
pm2-babysitter --app my-pm2-app --url http://localhost
```


PM2 Example
-----------
The pm2-babysitter is designed to operate as a process within PM2 itself.
To do this use it in a similar manor to the [CLI Example](#cli-example).

```
// Run pm2-babysitter as a PM2 process, monitoring 'my-pm2-app' and restart if 'http://localhost' stops responding
pm2 start `which pm2-babysitter` -- --app my-pm2-app --url http://localhost
```


As an example you can use the following to set up a both a test web server and a pm2-babysitter process.
The below commands assume you are already in the pm2-babysitter NPM directory

```
// Start a dummy web server
pm2 start test/servers/web.js --name web

// Start the pm2-babysitter process (in very-very verbose mode)
pm2 start cli.js -- --app web --url http://localhost:8080 -vvv
```
