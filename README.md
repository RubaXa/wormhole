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
	wormhole()["get-data"] = function (req, callback) {
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
		wormhole().call("get-data", { url: url, data: data }, function (err, data) {
			if (err) {
				dfd.reject(err);
			} else {
				dfd.resolve(data);
			}
		});

		return dfd.promise();
	};


	// I'm master!
	wormhole().on("master", function () {
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


---


### Peers

```js
womrhole()
	.on("peers", function (peers) {
		console.log("ids:", peers); // ["tab-id-1", "tab-id-2", ..]
	})
	.on("peers:add", function (id) {
		// ..
	})
	.on("peers:remove", function (id) {
		// ..
	})
;
```

---


### Executing the command on master


```js
// Register command (all tabs)
wormhole()["foo"] = function (data, next) {
	// bla-bla-bla
	next(null, data.reverse()); // or `next("error")`
};


// Calling the command (some tab)
wormhole().call("foo", [1, 2, 3], function (err, results) {
	console.log(results); // [3, 2, 1]
})
```


---


### Сomponents


#### wormhole.Emitter
Micro event emitter.

 * on(type:`String`, fn:`Function`):`this`
 * off(type:`String`, fn:`Function`):`this`
 * emit(type:`String`[, args:`*|Array`]):`this`

```js
var obj = womrhole.Emitter.apply({}); // or new womrhole.Emitter();

obj.on("foo", function () {
  console.log(arguments);
});


obj.emit("foo"); // []
obj.emit("foo", 1); // [1]
obj.emit("foo", [1, 2, 3]); // [1, 2, 3]
```


---


#### wormhole.store
Interface for `localStorage`.

 * get(key:`String`):`*`
 * set(key:`String`, value:`*`)
 * remove(key:`String`):`*`
 * on(type:`String`, fn:`Function`)
 * off(type:`String`, fn:`Function`)

```js
wormhole.store.on("change", function (key, data) {
	console.log(key, data);
});

wormhole.store.on("change:prop", function (key, value) {
	console.log(key, value);
});
```

---

### Utils

##### wormhole.uuid():`String`
A universally unique identifier (UUID) is an identifier standard used in software construction,
standardized by the Open Software Foundation (OSF) as part of the Distributed Computing Environment (DCE)
(c) [wiki](https://en.wikipedia.org/wiki/Universally_unique_identifier).


---


##### wormhole.debounce(fn:`Function`, wait:`Function`):`Function`
