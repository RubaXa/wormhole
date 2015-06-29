define(["./emitter", "./cors"], function (Emitter, cors) {
	var store,
		_storage,
		_storageNS = '__wh.store__.',
		_storageData = {}, // key => Object
		_storageItems = {}, // key => String

		_parseJSON = JSON.parse,
		_stringifyJSON = JSON.stringify
	;


	function _storageKey(key) {
		return _storageNS + key;
	}


	function _isStoreKey(key) {
		return key && (key !== _storageNS) && (key.indexOf(_storageNS) === 0);
	}


	function _getCleanedKey(key) {
		return key.substr(_storageNS.length);
	}


	/**
	 * Получить рабочий storage по названию
	 * @param   {String}  name
	 * @returns {sessionStorage}
	 * @private
	 */
	function _getStorage(name) {
		try {
			var storage = window[name + 'Storage'];

			storage.setItem(_storageNS, _storageNS);

			/* istanbul ignore else */
			if (storage.getItem(_storageNS) == _storageNS) {
				storage.removeItem(_storageNS);
				return storage;
			}
		} catch (err) { }
	}


	//  Пробуем получить sessionStorage, либо localStorage
	_storage = _getStorage('local');


	/**
	 * @desc Хранилище
	 * @module {store}
	 */
	store = Emitter.apply(/** @lends store */{
		/**
		 * Статус хранилища
		 * @type {boolean}
		 */
		enabled: !!_storage,


		/**
		 * Установить значение
		 * @param {String} key
		 * @param {*}      value
		 */
		set: function (key, value) {
			var fullKey = _storageKey(key);

			value = _stringifyJSON(value);

			_storage && _storage.setItem(fullKey, value);
			_onsync({ key: fullKey }, value); // принудительная синхронизация
		},


		/**
		 * Получить значение
		 * @param   {String}  key
		 * @returns {*}
		 */
		get: function (key) {
			var value = _storage.getItem(_storageKey(key));
			return typeof value === 'string' ? _parseJSON(value) : value;
		},


		/**
		 * Удалить значение
		 * @param  {String} key
		 */
		remove: function (key) {
			delete _storageData[key];
			delete _storageItems[key];
			_storage && _storage.removeItem(_storageKey(key));
		},


		/**
		 * Получить все данные из хранилища
		 * @retruns {Array}
		 */
		getAll: function () {
			var i = 0,
				n,
				key,
				data = {};

			if (_storage) {
				n = _storage.length;

				for (; i < n; i++ ) {
					key = _storage.key(i);

					if (_isStoreKey(key)) {
						data[_getCleanedKey(key)] = _parseJSON(_storage.getItem(key));
					}
				}
			}

			return data;
		},


		/**
		 * Пройтись по всем ключам
		 * @param  {Function}  iterator
		 */
		each: function (iterator) {
			if (_storage) {
				for (var i = 0, n = _storage.length, key; i < n; i++) {
					key = _storage.key(i);
					if (_isStoreKey(key)) {
						iterator(_storage.getItem(key), _getCleanedKey(key));
					}
				}
			}
		}
	});


	/**
	 * Обработчик обновления хранилища
	 * @param  {Event|Object}  evt
	 * @param  {String}        [value]
	 * @private
	 */
	function _onsync(evt, value) {
		var i = 0,
			n = _storage.length,
			fullKey = evt.key,
			key;

		// Синхронизация работает
		store.events = true;

		if (!fullKey) {
			// Плохой браузер, придется искать самому, что изменилось
			for (; i < n; i++ ) {
				fullKey = _storage.key(i);

				if (_isStoreKey(fullKey)) {
					value = _storage.getItem(fullKey);

					if (_storageItems[fullKey] !== value) {
						_storageItems[fullKey] = value;
						_onsync({ key: fullKey }, value);
					}
				}
			}
		}
		else if (_isStoreKey(fullKey)) {
			key = _getCleanedKey(fullKey);

			if (key) { // Фильтруем событий при проверки localStorage
				value = value !== void 0 ? value : _storage.getItem(fullKey);
				_storageData[key] = _parseJSON(value);
				_storageItems[fullKey] = value + '';

				store.emit('change', [key, _storageData]);
				store.emit('change:' + key, [key, _storageData[key]]);
			}
		}
	}


	// Получаем текущее состояние
	_storage && (function () {
		var i = _storage.length,
			fullKey,
			key,
			value,
			_onsyncNext = function (evt) {
				setTimeout(function () {
					_onsync(evt);
				}, 0);
			};

		/* istanbul ignore next */
		while (i--) {
			fullKey = _storage.key(i);

			if (_isStoreKey(fullKey)) {
				key = _getCleanedKey(fullKey);
				value = _storage.getItem(fullKey);

				_storageData[key] = _parseJSON(value);
				_storageItems[fullKey] = value;
			}
		}

		/* istanbul ignore else */
		if (window.addEventListener) {
			window.addEventListener('storage', _onsyncNext);
			document.addEventListener('storage', _onsyncNext);
		} else {
			window.attachEvent('onstorage', _onsyncNext);
			document.attachEvent('onstorage', _onsyncNext);
		}


		// Проверяем рабочесть события хранилища (Bug #136356)
//		_storage.setItem('ping', _storageNS);
//		setTimeout(function () {
//			_storage.removeItem('ping' + _storageNS);
//
//			if (!store.events) {
//				console.log('onStorage not supported:', location.href, store.events);
//				setInterval(function () { _onsync({}); }, 250);
//			}
//		}, 500);
	})();


	/**
	 * Получить удаленное хранилище
	 * @param   {string}   url
	 * @param   {function} ready
	 * @returns {store}
	 */
	store.remote = function (url, ready) {
		var _data = {},
			_store = Emitter.apply({
				set: function (key, name) {
					_data[key] = name;

					_store.emit('change', [key, _data]);
					_store.emit('change:' + key, [key, _data[key]]);
				},

				get: function (key) {
					return _data[key];
				},

				remove: function (key) {
					delete _data[key];
				},

				getAll: function () {
					return _data;
				},

				each: function (iterator) {
					for (var key in _data) {
						if (_data.hasOwnProperty(key)) {
							iterator(_data, key);
						}
					}
				}
			}),

			iframe = document.createElement('iframe'),
			adapter = cors(iframe);


		iframe.onload = function () {
			adapter.call('register', [], function (err, storeData) {
				if (storeData) {
					iframe.onload = null;

					// Получаем данные хранилища
					for (var key in storeData) {
						_data[key] = storeData[key];
					}

					// Получаем данные от iframe
					cors.on('data', function (evt) {
						var key = evt.key,
							data = evt.data,
							value = data[key];

						_data[key] = value;

						_store.emit('change', [key, data]);
						_store.emit('change:' + key, [key, value]);
					});

					// Установить
					_store.set = function (key, value) {
						adapter.call('store', { cmd: 'set', key: key, value: value });
					};

					// Удалить
					_store.remove = function (key) {
						delete _data[key];
						adapter.call('store', { cmd: 'remove', key: key });
					};

					ready && ready(_store);
				}
			});
		};


		iframe.src = url;
		iframe.style.left = '-1000px';
		iframe.style.position = 'absolute';


		// Пробуем вставить в body
		(function _tryAgain() {
			try {
				document.body.appendChild(iframe);
			} catch (err) {
				setTimeout(_tryAgain, 100);
			}
		})();


		return _store;
	};



	// Export
	return store;
});
