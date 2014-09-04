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
		_createWin('store.test.html').then(function (el) {
			// Получаем экземпляр store из iframe
			var winStore = el.contentWindow.wormhole.store;

			// Сверяем значения
			equal(winStore.get('rand'), rand);

			// Устанавливаем какое-то значения, для проверки событий
			winStore.set('foo', rand);

			setTimeout(function () {
				// Проверяем события
				deepEqual(log, [
					'change',
					'change:foo-' + rand
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
})();
