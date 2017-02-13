PM2-Babysitter
==============
Oversight to PM2 which will reboot servers based on a ruleset.

In its simplest form this module will ensure that primary processes will be rebooted when they stop responding.

In a more complex form: an advanced ruleset can be defined to restart a PM2 process structure if something goes horribly wrong.


```javascript
var babysitter = require('pm2-babysitter');

// Just watch this process and reboot it if port 80 stops responding. This invokation is actually shorthand for the below
babysitter.add('my-pm2-process', 'http://localhost');


// Full version of the above
babysitter.add('my-pm2-process', [
	babysitter.rules.get('http://localhost'),
]);


// More detailed version of the above which also checks for a string (or a RegExp if given one)
babysitter.add('my-pm2-process', [
	babysitter.rules.get('http://localhost', 'Hello World'),
]);


// Expect a JSON response from a given URL and validate that it has 'foo.bar.baz'
babysitter.add('my-pm2-process', [
	babysitter.rules.get('http://localhost', function(cb, res) {
		// Perform JSON validation here
		if (_.has(res.body, 'foo.bar.baz')) return cb('Invalid response');
		cb();
	}),
]);
```
