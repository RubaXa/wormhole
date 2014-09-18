define(["emitter"], function (Emitter) {
	var store,
		_storage,
		_storageNS = '__wormhole.store__.',
		_storageData = {},

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

			_storage && _storage.setItem(fullKey, _stringifyJSON(value));
			_onsync({ key: fullKey }); // принудительная синхронизация
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
			_storage && _storage.removeItem(_storageKey(key));
		}
	});


	/**
	 * Обработчик обновления хранилища
	 * @param evt
	 * @private
	 */
	function _onsync(evt) {
		var fullKey = evt.key,
			key = _getCleanedKey(fullKey),
			newValue
		;

		if (key && _isStoreKey(fullKey)) {
			newValue = _parseJSON(_storage.getItem(fullKey));
			_storageData[key] = newValue;

			store.emit('change', [key, _storageData]);
			store.emit('change:' + key, [key, newValue]);
		}
	}


	// Получаем текущее состояние
	_storage && (function () {
		var i = _storage.length,
			key;

		/* istanbul ignore next */
		while (i--) {
			key = _storage.key(i);

			if (_isStoreKey(key)) {
				_storageData[_getCleanedKey(key)] = _parseJSON(_storage.getItem(key));
			}
		}

		/* istanbul ignore else */
		if (window.addEventListener) {
			window.addEventListener('storage', _onsync);
		} else {
			window.attachEvent('onstorage', _onsync);
		}
	})();


	// Export
	return store;
});
