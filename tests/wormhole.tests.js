module('wormhole');



(function () {
	var REMOTE_URL = 'http://127.0.0.1:4790';
	var $fixture = $('#qunit-fixture');


	function _createWin(url) {
		var dfd = $.Deferred();

		$('<iframe src="' + (url || REMOTE_URL +  '/tests/cors.test.html')  + '"/>')
			.load(function (evt) { dfd.resolve(evt.target); })
			.appendTo($fixture)
		;

		return dfd;
	}


	// Излучатель: on/off/emit
	test('emitter', function () {
		var log = [];
		var emitter = new wormhole.emitter;
		var onFoo = function (data) {
			log.push('foo-' + data);
		};
		var onBar = function (data) {
			log.push('bar-' + data);
		};
		var onBaz = function () {
			log.push('baz-' + [].slice.call(arguments, 0).join('.'));
		};

		emitter.on("foo", onFoo);
		emitter.on("bar", onBar);
		emitter.on("baz", onBaz);

		emitter.emit("foo", 1);
		emitter.emit("bar", 1);

		emitter.off("foo", onBar);
		emitter.emit("foo", 2);
		emitter.emit("bar", 2);

		emitter.off("foo", onFoo);
		emitter.emit("foo", 3);
		emitter.emit("bar", 3);

		emitter.emit('baz');
		emitter.emit('baz', [1, 2]);
		emitter.emit('baz', [1, 2, 3]);
		emitter.emit('baz', [1, 2, 3, 4, 5]);

		equal(log + '', 'foo-1,bar-1,foo-2,bar-2,bar-3,baz-,baz-1.2,baz-1.2.3,baz-1.2.3.4.5');
	});


	// Взаимодействие с удаленным сервером
	asyncTest('cors', function () {
		var cors = wormhole.cors;


		// Создаем два iframe
		$.when(_createWin(), _createWin()).then(function (foo, bar) {
			var log = [];

			// Подписываемся по получение данных в текущем окне
			cors.on('data', function (data) {
				log.push(data);
			});

			// Отправляем данные в iframe
			cors(foo).send("Wow");

			// Определим команды, которые может вызвать удаленный сервер
			cors.well = function (data) {
				log.push('well ' + data);
			};

			// Команда с ошибокй
			cors.fail = function () {
				throw "error";
			};

			// Вызываем удаленную команду у iframe
			cors(bar).call('remote', { value: 321 }, function (err, response) {
				log.push(response);
			});

			// Вызываем неопределенную команду
			cors(bar).call('unknown', function (err) {
				log.push(err);
			});

			// Команду с ошибкой
			cors(bar).call('fail', function (err) {
				log.push(err);
			});

			// Проверям результат
			setTimeout(function () {
				deepEqual(log, [
					'Wow!',
					'well done',
					{ bar: true, value: 642 },
					'wormhole.cors.unknown: method not found',
					'wormhole.cors.fail: remote error'
				]);
				start();
			}, 10);
		});
	});


	// Проверяем работу хранилища и его изменения
	asyncTest('store', function () {
		var log = [];
		var store = wormhole.store;
		var rand = Math.random();

		ok(store.enabled, 'enabled');

		// Подписываемся на изменение данных
		store.on('change:' + rand, function (data) {
			equal(data, rand);
			log.push('rand-val');
		});

		store.set(rand, rand);
		store.set('rand', rand);

		// Подписываемся на изменение данных
		store.on('change', function (data) {
			log.push('change');
		});

		// Подписываем на конкретный ключ
		store.on('change:foo', function (val) {
			log.push('change:foo-' + val)
		});

		// Создаем iframe на текущий домен
		_createWin('local.test.html').then(function (el) {
			// Получаем экземпляр store из iframe
			var winStore = el.contentWindow.wormhole.store;

			// Сверяем значения
			equal(winStore.get('rand'), rand);

			// Устанавливаем какое-то значения, для проверки событий
			winStore.set('foo', rand);

			// Выставляем значение и сразу читаем его
			store.set('bar', rand);
			equal(winStore.get('bar'), rand, 'bar.rand');

			winStore.set('bar', rand + '!');
			equal(store.get('bar'), rand + '!', 'bar.rand!');

			setTimeout(function () {
				// Проверяем события
				deepEqual(log, [
					'rand-val',
					'change',
					'change',
					'change:foo-' + rand,
					'change'
				]);

				// Чтение
				equal(store.get('foo'), rand);

				// Удаление
				store.remove('foo');
				equal(store.get('foo'), void 0);

				start();
			}, 100);
		});
	});


	// Стресс-тест событий хранилища
	0 && asyncTest('store:stress', function () {
		var log = [],
			key = Math.random(),
			store = wormhole.store,
			minDelay = 100,
			maxIterations = 100,
			_log = Array.apply(null, new Array(maxIterations)).map(function (_, i) {
				return i;
			})
		;

		store.on('change:' + key, function (val) {
			log.push(val)
		});

		_createWin('local.test.html').then(function (el) {
			var winStore = el.contentWindow.wormhole.store;

			for (var i = 0; i < maxIterations; i++) {
				setTimeout(function () {
					winStore.set(key, this);
				}.bind(i), i*minDelay);
			}

			setTimeout(function () {
				equal(log.length, maxIterations);
				deepEqual(log, _log);
				start();
			}, minDelay * maxIterations);
		});
	});


	// Тестируем Worker
	asyncTest('worker', function () {
		var iteration = 0,
			maxWorkers = 20,
			maxIterations = 2
		;

		$.Deferred().resolve()
			.then(function _next() {
				var dfd = $.Deferred(),
					name = 'iteration-' + iteration,
					peersLog = [],
					_peersLog = [1], // с чем сравниваем
					pid
				;


				_createWin('local.test.html?worker=' + [iteration, 0]).then(function (el) {
					 new el.contentWindow.wormhole.Worker(name).on('peers', function (count) {
						peersLog.push(count);

						clearTimeout(pid);
						pid = setTimeout(dfd.resolve, 100);
					});

					Array.apply(null, new Array(maxWorkers - 1)).forEach(function (_, i) {
						_peersLog.push(++i + 1);

						_createWin('local.test.html?worker=' + [iteration, i]).then(function (el) {
							new el.contentWindow.wormhole.Worker(name);
						});
					});
				});

				return dfd.then(function () {
					deepEqual(peersLog, _peersLog, name);

					if (++iteration < maxIterations) {
						return _next();
					}
				});
			})
			.then(function () {
				start();
			})
		;
	});
})();
