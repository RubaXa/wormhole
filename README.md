# Wormhole
It's better EventEmitter for communication between tabs with supporting Master/Slave.

```
npm i --save-dev wormhole.js
```


### Features
 * [One connection on WebSocket](#ws) for all tabs.
 * Support [Master/Slave](#ms)
 * [Cross-domain communication](#cors)
 * SharedWorker or fallback to localStorage
 * IE 8+, Chrome 10+, FireFox 10+, Opera 10+, Safari 6+
 * Test coverage ([run](http://rubaxa.github.io/wormhole/tests/))


---


### Basic example

```js
import wormhole from 'wormhole.js'; // yes, with ".js", it's not mistake

// All tabs
wormhole().on('coords', (x, y) => {
	console.log(x, y);
});

// Some tab
wormhole().emit('coords', [5, 10]);

// Master tab
if (wormhole().master) {
	// ..
}

wormhole().on('master', () => {
	console.log('Wow!');
});
```


---


<a name="ws"></a>

### One connection on WebSocket for all tabs
Module `wormhole.js/ws` implements WebSocket-like interface:
https://rubaxa.github.io/wormhole/?ws=y

```js
import WS from 'wormhole.js/ws';

// Create WebScoket (wormhole-socket)
const socket = new WS('ws://echo.websocket.org'); // OR new WS('...', null, hole);

socket.onopen = () => console.log('Connected');
socket.onmessage = ({data}) => console.log('Received:', data);

// Unique event
socket.onmaster = () => {
	console.log('Yes, I\'m master!');
};

// Some tab
socket.send({foo: 'bar'})

// All tabs:
//  "Received:" {foo: 'bar'}
```

---


<a name="cors"></a>

### CORS example

 1. Create a subdomain, ex.: `http://wormhole.youdomain.com/`;
 2. Copy-paste [universal.html](./universal.html) and [wormhole.js](./wormhole.js) into root;
 3. Check access `http://wormhole.youdomain.com/universal.html`;
 4. Profit:

```js
// http://foo.youdomain.com/
import {Universal} from 'wormhole.js';
const hole = new Universal('http://wormhole.youdomain.com/universal.html');

hole.on('data', (data) => {
	console.log(data);
});


// http://bar.youdomain.com/
import {Universal} from 'wormhole.js';
const hole = new Universal('http://wormhole.youdomain.com/universal.html');

hole.emit('data', 'any data');
```


---


<a name="ms"></a>

### Master/slave example

```js
import wormhole from 'wormhole.js';

// All tabs (main.js)
// Define remote command (master)
wormhole()['get-data'] = (function (_cache) {
	return function getData(req, callback) {
		if (!_cache.hasOwnProperty(req.url)) {
			_cache[req.url] = fetch(req.url).then(res => res.json());
		}

		return _cache[key];
	};
})({});

// Get remote data method
function getData(url) {
	return new Promise((resolve, reject) => {
		// Calling command on master (from slave... or the master, is not important)
		wormhole().call(
			'get-data', // command
			{url}, // arguments
			(err, json) => err ? reject(err) : resolve(json) // callback(err, result)
		);
	});
};

// I'm master!
wormhole().on('master', () => {
	// some code
});

// Tab #X
getData('/path/to/api').then((json) => {
	// Send ajax request
	console.log(result);
});

// Tab #Y
getData('/path/to/api').then((result) => {
	// From master cache
	console.log(result);
});
```


---


### Peers

```js
wormhole()
	.on('peers', (peers) => {
		console.log('ids:', peers); // ['tab-id-1', 'tab-id-2', ..]
	})
	.on('peers:add', (id) => {
		// ..
	})
	.on('peers:remove', (id) => {
		// ..
	})
;
```

---


### Executing the command on master


```js
// Register command (all tabs)
wormhole()['foo'] = (data, next) => {
	// bla-bla-bla
	next(null, data.reverse()); // or `next('error')`
};


// Calling the command (some tab)
wormhole().call('foo', [1, 2, 3], (err, results) => {
	console.log(results); // [3, 2, 1]
})
```


---


### Modules

 - [Emitter](#m-emitter) — Micro event emitter
 - [cors](#m-cors) — Handy wrapper over `postMessage`.
 - [store](#m-store) — Safe and a handy wrapper over `localStorage`.


---

<a name="m-emitter"></a>

#### wormhole.Emitter
Micro event emitter.

 - **on**(type:`String`, fn:`Function`):`this`
 - **off**(type:`String`, fn:`Function`):`this`
 - **emit**(type:`String`[, args:`*|Array`]):`this`

```js
import {Emitter} from 'wormhole.js';

const obj = Emitter.apply({}); // or new wormhole.Emitter();

obj.on('foo', () => {
  console.log(arguments);
});

obj.emit('foo'); // []
obj.emit('foo', 1); // [1]
obj.emit('foo', [1, 2, 3]); // [1, 2, 3]
```


---

<a name="m-cors"></a>

#### wormhole.cors
Handy wrapper over `postMessage`.

```js
import {cors} from 'wormhole.js';

// Main-document
cors.on('data', (data) => {
	console.log('Received:', data);
});

cors['some:command'] = (value) => value * 2;

// IFrame
cors(parent).send({foo: 'bar'});
// [main-document] "Received:" {foo: 'bar'}

cors(parent).call('some:command', 3, (err, result) => {
	console.log('Error:', err, 'Result:', result);
	// [iframe] "Error:" null "Result:" 6
});
```


---

<a name="m-store"></a>

#### wormhole.store
Safe and a handy wrapper over `localStorage`.

 - **get**(key:`String`):`*`
 - **set**(key:`String`, value:`*`)
 - **remove**(key:`String`):`*`
 - **on**(type:`String`, fn:`Function`)
 - **off**(type:`String`, fn:`Function`)

```js
import {store} from 'wormhole.js';

store.on('change', (key, data) => {
	console.log('change -> ', key, data);
});

store.on('change:prop', (key, value) => {
	console.log('change:prop -> ', key, value);
});

store.set('foo', {bar: 'baz'});
// change -> foo {bar: 'baz'}

store.set('prop', {qux: 'ok'});
// change -> prop {qux: 'ok'}
// change:prop -> prop {qux: 'ok'}
```

---


### Utils

 - [uuid](#uuid)
 - [debounce](#debounce)


---

<a name="uuid"></a>

##### wormhole.uuid():`String`
A universally unique identifier (UUID) is an identifier standard used in software construction,
standardized by the Open Software Foundation (OSF) as part of the Distributed Computing Environment (DCE)
(c) [wiki](https://en.wikipedia.org/wiki/Universally_unique_identifier).


---

<a name="debounce"></a>

##### wormhole.debounce(fn:`Function`, delay:`Number`[, immediate:`Boolean`]):`Function`


----


### Development

- `npm test`
- `npm run dev` — run dev watcher
- `npm run build`