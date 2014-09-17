# Wormhole
Is EventEmitter for communication between tabs.


### Features
 * Cross-domain communication
 * SharedWorkers or fallback to sessionStorage
 * IE 8+, Chrome 10+, FireFox 10+, Opera 10+, Safari 6+


---


### Basic example

```js
// All tabs
wormhole().on("coords", function (x, y) {
	console.log(x, y);
});


// Some tab
wormhole().emit("coords", [5, 10]);
```

---


### CORS example
:exclamation: Not implemented :exclamation:

```js
// http://foo.domain.com/
var hole = new wormhole.Universal("http://domain.com/path/to/wormhole/wormhole.cors.html");

hole.on("data", function (data) {
	console.log(data);
});


// http://bar.domain.com/
var hole = new wormhole.Universal("http://domain.com/path/to/wormhole/wormhole.cors.html");

hole.emit("data", "any data");
```

---

### Master/slave example

```js
// All tabs
(function ($) {
	var _cache = {},
		_getCacheKey = function (req) {
			return req.url + JSON.stringify(req.data);
		}
	;


	// Define remote command (master)
	wormhole["get-data"] = function (req, callback) {
		var key = _getCacheKey(req),
			promise = _cache[key];

		if (!promise) {
			_cache[key] = promise = $.get(req.url, req.data);
		}

		return promise
			.done(function (result) {
				callback(null, result);
			})
			.fail(function (err) {
				delete _cache[key];
				callback(err);
			})
		;
	};


	// Get remote data
	$.getData = function (url, data) {
		var dfd = $.Deferred();

		// Calling command on master (from slave... or the master, is not important)
		wormhole.call("get-data", { url: url, data: data }, function (err, data) {
			if (err) {
				dfd.reject(err);
			} else {
				dfd.resolve(data);
			}
		});

		return dfd.promise();
	};


	// I'm master!
	wormhole.on("master", function () {
		// some code
	});
})(jQuery);



// Tab #X
$.getData("/path/to/api").then(function (result) {
	// Send ajax request
	console.log(result);
});


// Tab #Y
$.getData("/path/to/api").then(function (result) {
	// From master cache
	console.log(result);
});
```

