define(["emitter"], function (Emitter) {
	var store,
		_storage,
		_storageNS = '__wormhole.store__.',
		_storageData = {}, // key => Object
		_storageItems = {}, // key => String

		_parseJSON = JSON.parse,
		_stringifyJSON = JSON.stringify
	;


	function _storageKey(key) {
		return _storageNS + key;
	}


	function _isStoreKey(key) {
		return (key !== _storageNS) && key.indexOf(_storageNS) === 0;
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
			value;

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
			window.addEventListener('storage', _onsync);
			document.addEventListener('storage', _onsync);
		} else {
			window.attachEvent('onstorage', _onsync);
			document.attachEvent('onstorage', _onsync);
		}
	})();


	// Export
	return store;
});
