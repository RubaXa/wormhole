(function () {
	QUnit.module('wormhole.store');


	// Проверяем работу хранилища и его изменения
	QUnit.test('local', function (assert) {
		var log = [];
		var store = wormhole.store;
		var rand = Math.random();
		var done = assert.async();

		assert.ok(store.enabled, 'enabled');

		// Подписываемся на изменение данных
		store.on('change:' + rand, function (data) {
			assert.equal(data, rand);
			log.push('rand-val');
		});

		store.set(rand, rand);
		store.set('rand', rand);

		// Подписываемся на изменение данных
		store.on('change', function () {
			log.push('change');
		});

		// Подписываем на конкретный ключ
		store.on('change:foo', function (key, val) {
			log.push('change:foo-' + val);
		});


		// Создаем iframe на текущий домен
		_createWin('local.test.html').then(function (el) {
			// Получаем экземпляр store из iframe
			var winStore = el.contentWindow.wormhole.store;

			// Сверяем значения
			assert.equal(winStore.get('rand'), rand);

			// Устанавливаем какое-то значения, для проверки событий
			winStore.set('foo', rand);

			// Выставляем значение и сразу читаем его
			store.set('bar', rand);
			assert.equal(winStore.get('bar'), rand, 'bar.rand');

			winStore.set('bar', rand + '!');
			assert.equal(store.get('bar'), rand + '!', 'bar.rand!');

			setTimeout(function () {
				// Проверяем события
				assert.deepEqual(log, [
					'rand-val',
					'change',
					'change',
					'change:foo-' + rand,
					'change'
				]);

				// Чтение
				assert.equal(store.get('foo'), rand);

				// Удаление
				store.remove('foo');
				assert.equal(store.get('foo'), void 0);

				done();
			}, 100);
		});
	});


	QUnit.test('remote', function (assert) {
		var log = [];
		var rnd = Math.random();
		var remoteRnd = Math.random();
		var store = wormhole.store.remote('http://localhost:4791/universal.html', function (_store) {
			assert.equal(store, _store, 'ready');
			_store.set('foo', 'self:' + rnd);
		});
		var done = assert.async();

		store.on('change', function (key, data) {
			log.push('all->' + key + ':' + data[key]);
		});

		store.on('change:foo', function (key, val) {
			log.push('foo.prop->' + val);
		});

		_createWin('remote:store.cors.test.html?rnd=' + remoteRnd).always(function () {
			setTimeout(function () {
				assert.deepEqual(log, [
					'all->foo:self:' + rnd,
					'foo.prop->self:' + rnd,
					'all->foo:remote:' + remoteRnd,
					'foo.prop->remote:' + remoteRnd
				]);
				done();
			}, 2000);
		});
	});
})();
