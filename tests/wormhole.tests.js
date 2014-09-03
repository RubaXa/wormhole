module('wormhole');



(function () {
	var REMOTE_URL = 'http://127.0.0.1:4790';
	var $fixture = $('#qunit-fixture');


	function _createWin(url) {
		var dfd = $.Deferred();

		$('<iframe src="' + (url || REMOTE_URL +  '/tests/cors.test.html')  + '"/>')
			.load(function (evt) {
				dfd.resolve(evt.target);
			})
			.appendTo($fixture)
		;

		return dfd;
	}


	test('emitter', function () {
		var log = [];
		var emitter = new wormhole.emitter;
		var onFoo = function (data) {
			log.push('foo-' + data);
		};
		var onBar = function (data) {
			log.push('bar-' + data);
		};

		emitter.on("foo", onFoo);

		emitter.on("bar", onBar);

		emitter.emit("foo", 1);
		emitter.emit("bar", 1);

		emitter.off("foo", onBar);
		emitter.emit("foo", 2);
		emitter.emit("bar", 2);

		emitter.off("foo", onFoo);
		emitter.emit("foo", 3);
		emitter.emit("bar", 3);

		equal(log + '', 'foo-1,bar-1,foo-2,bar-2,bar-3');
	});


	asyncTest('cors', function () {
		var cors = wormhole.cors;


		$.when(_createWin(), _createWin()).then(function (foo, bar) {
			var log = [];

			cors.on('data', function (data) {
				log.push(data);
			});

			cors(foo).send("Wow");

			cors(bar).call('remote', { value: 321 }, function (err, response) {
				log.push(response);
			});


			setTimeout(function () {
				deepEqual(log, [
					'Wow!',
					{ bar: true, value: 642 }
				]);
				start();
			}, 10);
		});
	});


	asyncTest('store', function () {
		var log = [];
		var store = wormhole.store;
		var rand = Math.random();

		store.set('rand', rand);

		store.on('change', function (data) {
			log.push('change');
		});

		store.on('change:foo', function (val) {
			log.push('change:foo-' + val)
		});

		_createWin('store.test.html').then(function (el) {
			var winStore = el.contentWindow.wormhole.store;

			equal(winStore.get('rand'), rand);
			winStore.set('foo', rand);

			setTimeout(function () {
				deepEqual(log, [
					'change',
					'change:foo-' + rand
				]);

				equal(store.get('foo'), rand);

				store.remove('foo');
				equal(store.get('foo'), void 0);

				start();
			}, 100);
		});
	});
})();
