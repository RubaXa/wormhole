(function (window, document) {
"use strict";
	var now = Date.now || /* istanbul ignore next */ function () {
		return +(new Date);
	};

	

	var floor = Math.floor,
		random = Math.random
	;


	function s4() {
		return floor(random() * 0x10000 /* 65536 */).toString(16);
	}


	/**
	 * UUID — http://ru.wikipedia.org/wiki/UUID
	 * @returns {String}
	 */
	function uuid() {
		return (s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4());
	}


	/**
	 * Генерация hash на основе строки
	 * @param   {String} str
	 * @returns {String}
	 */
	uuid.hash = function (str) {
		var hash = 0,
			i = 0,
			length = str.length
		;

		/* istanbul ignore else */
		if (length > 0) {
			for (; i < length; i++) {
				hash = ((hash << 5) - hash) + str.charCodeAt(i);
				hash |= 0; // Convert to 32bit integer
			}
		}

		return hash.toString(36);
	};


	

	function debounce(func, delay, immediate) {
		var timeout;

		return function() {
			var context = this,
				args = arguments;

			clearTimeout(timeout);

			timeout = setTimeout(function() {
				timeout = null;

				/* istanbul ignore else */
				if (!immediate) {
					func.apply(context, args);
				}
			}, delay);

			/* istanbul ignore next */
			if (immediate && !timeout) {
				func.apply(context, args);
			}
		};
	}


	

	var __emitter__ = '__emitter__';

	function getListeners(obj, name) {
		if (obj[__emitter__] === void 0) {
			obj[__emitter__] = {};
		}

		obj = obj[__emitter__];

		if (obj[name] === void 0) {
			obj[name] = [];
		}

		return obj[name];
	}


	/**
	 * @class Emitter
	 * @desc  Микро-излучатель
	 */
	function Emitter() {
	}


	Emitter.fn = Emitter.prototype = /** @lends Emitter.prototype */ {
		/**
		 * Подписаться на событие
		 * @param   {String}   name
		 * @param   {Function} fn
		 * @returns {Emitter}
		 */
		on: function (name, fn) {
			var list = getListeners(this, name);
			list.push(fn);
			return this;
		},


		/**
		 * Отписаться от событие
		 * @param   {String}   name
		 * @param   {Function} fn
		 * @returns {Emitter}
		 */
		off: function (name, fn) {
			if (name === void 0) {
				delete this[__emitter__];
			}
			else {
				var list = getListeners(this, name),
					i = list.length;

				while (i--) {
					// Ищем слушателя и удаляем (indexOf - IE > 8)
					if (list[i] === fn) {
						list.splice(i, 1);
						break;
					}
				}
			}

			return this;
		},


		/**
		 * Подписаться на событие и отписаться сразу после его получения
		 * @param   {String}   name
		 * @param   {Function} fn
		 * @returns {Emitter}
		 */
		one: function (name, fn) {
			var proxy = function () {
				this.off(name, proxy);
				return fn.apply(this, arguments);
			};

			return this.on(name, proxy);
		},


		/**
		 * Распространить данные
		 * @param   {String}   name
		 * @param   {*}        [args]
		 */
		emit: function (name, args) {
			var listeners = getListeners(this, name),
				i = listeners.length,
				nargs
			;

			args = (arguments.length === 1) ? [] : [].concat(args);
			nargs = args.length;

			while (i--) {
				if (nargs === 0) {
					listeners[i].call(this);
				}
				else if (nargs === 1){
					listeners[i].call(this, args[0]);
				}
				else if (nargs === 2){
					listeners[i].call(this, args[0], args[1]);
				}
				else {
					listeners[i].apply(this, args);
				}
			}
		}
	};


	/**
	 * Подмешать методы
	 * @param   {*}  target
	 * @returns {*}
	 * @method
	 */
	Emitter.apply = function (target) {
		target.on = Emitter.fn.on;
		target.off = Emitter.fn.off;
		target.one = Emitter.fn.one;
		target.emit = Emitter.fn.emit;

		return target;
	};


	Emitter.getListeners = getListeners;


	

	function getOwn(obj, prop) {
		return !(prop in getOwn) && obj && obj.hasOwnProperty(prop) ? obj[prop] : null;
	}

	

	var _corsId = 1,
		_corsExpando = '__cors__',
		_corsCallback = {},
		_parseJSON = JSON.parse,
		_stringifyJSON = JSON.stringify
	;


	/**
	 * @class  cors
	 * @desc   Обертка над postMessage
	 * @param  {Window}  el
	 */
	function cors(el) {
		if (!(this instanceof cors)) {
			return new cors(el);
		}

		this.el = el;
	}


	cors.fn = cors.prototype = /** @lends cors.prototype */ {
		/**
		 * Вызывать удаленную команду
		 * @param {String}   cmd    команда
		 * @param {*}        [data] данные
		 * @param {Function} [callback] функция обратного вызова, получает: `error` и `result`
		 */
		call: function (cmd, data, callback) {
			if (typeof data === 'function') {
				callback = data;
				data = void 0;
			}

			var evt = {
				cmd: cmd,
				data: data
			};

			evt[_corsExpando] = ++_corsId;
			_corsCallback[_corsId] = callback;

			this.send(evt);
		},


		/**
		 * Отправить даныне
		 * @param {*} data
		 */
		send: function (data) {
			var window = this.el;

			try {
				// Если это iframe
				window = window.contentWindow || /* istanbul ignore next */ window;
			} catch (err) {
			}

			try {
				window.postMessage(_corsExpando + _stringifyJSON(data), '*');
			}
			catch (err) {}
		}
	};


	/**
	 * Получение `postMessage`
	 * @param {Event} evt
	 * @private
	 */
	function _onmessage(evt) {
		evt = evt || /* istanbul ignore next */ window.event;

		var id,
			resp = {},
			data = evt.data,
			source = evt.source,
			func;

		/* istanbul ignore else */
		if (typeof data === 'string' && data.indexOf(_corsExpando) === 0) {
			// Наше сообщение
			try {
				// Парсим данные
				data = _parseJSON(evt.data.substr(_corsExpando.length));
				id = data[_corsExpando];

				if (id) {
					// Это call или ответ на него
					if (data.response) {
						/* istanbul ignore else */
						if (_corsCallback[id]) {
							_corsCallback[id](data.error, data.result);
							delete _corsCallback[id];
						}
					}
					else {
						// Фомируем ответ
						resp.response =
						resp[_corsExpando] = id;

						try {
							func = getOwn(cors, data.cmd);

							if (func) {
								resp.result = func(data.data, source);
							} else {
								throw 'method not found';
							}
						} catch (err) {
							resp.error = 'wormhole.cors.' + data.cmd + ': ' + err.toString();
						}

						cors(evt.source).send(resp);
					}
				}
				else {
					cors.emit('data', [data, source]);
				}

			}
			catch (err) {
				/* istanbul ignore next */
				cors.emit('error', err);
			}
		}
	}


	// Подмешиваем
	Emitter.apply(cors);


	/* istanbul ignore else */
	if (window.addEventListener) {
		window.addEventListener('message', _onmessage, false);
	} else {
		window.attachEvent('onmessage', _onmessage);
	}


	

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



	

	var _stringifyJSON = JSON.stringify;


	/**
	 * @type {URL}
	 */
	var URL = window.URL;


	/**
	 * @type {Blob}
	 */
	var Blob = window.Blob;


	/**
	 * @type {SharedWorker}
	 */
	var SharedWorker = window.SharedWorker;


	/* istanbul ignore next */
	var Worker = {
		support: !!(URL && Blob && SharedWorker),


		/**
		 * Создать работника
		 * @param   {String}  url
		 * @returns {SharedWorker}
		 */
		create: function (url) {
			return new SharedWorker(url);
		},


		/**
		 * Получить ссылку на работника
		 * @param   {String} name
		 * @returns {String}
		 * @private
		 */
		getSharedURL: function (name) {
			// Код воркера
			var source = '(' + (function (window) {
				var ports = [];
				var master = null;


				function checkMaster() {
					if (!master && (ports.length > 0)) {
						master = ports[0];
						master.postMessage('MASTER');
					}
				}


				function broadcast(data) {
					ports.forEach(function (port) {
						port.postMessage(data);
					});
				}


				function removePort(port) {
					var idx = ports.indexOf(port);

					if (idx > -1) {
						ports.splice(idx, 1);
						peersUpdated();
					}

					if (port === master) {
						master = null;
					}
				}


				function peersUpdated() {
					broadcast({
						type: 'peers',
						data: ports.map(function (port) {
							return port.holeId;
						})
					});
				}


				// Опришиваем и ищем зомби
				setInterval(function () {
					var i = ports.length, port;

					while (i--) {
						port = ports[i];

						if (port.zombie) {
							// Убиваем зомби
							removePort(port);
						}
						else {
							port.zombie = true; // Помечаем как зомби
							port.postMessage('PING');
						}
					}

					checkMaster();
				}, 1000);


				window.addEventListener('connect', function (evt) {
					var port = evt.ports[0];

					port.onmessage = function (evt) {
						var data = evt.data;

						if (data === 'PONG') {
							port.zombie = false; // живой порт
						}
						else if (data === 'DESTROY') {
							// Удаляем порт
							removePort(port);
							checkMaster();
						}
						else if (data.hole) {
							// Обновление meta информации
							port.holeId = data.hole.id;
							peersUpdated();
						}
						else {
							broadcast({ type: data.type, data: data.data });
						}
					};

					ports.push(port);

					port.start();
					port.postMessage('CONNECTED');

					checkMaster();
				}, false);
			}).toString() + ')(this, ' + _stringifyJSON(name) + ')';

			return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
		}
	};


	

	var UPD_META_DELAY = 5 * 1000, // ms, как часто обновлять мата данные
		MASTER_DELAY = UPD_META_DELAY * 2, // ms, сколько времени считать мастер живым
		PEERS_DELAY = UPD_META_DELAY * 4, // ms, сколько времени считать peer живым
		QUEUE_WAIT = UPD_META_DELAY * 2, // ms, за какой период времени держать очередь событий

		_emitterEmit = Emitter.fn.emit
	;


	/**
	 * Проверка наличия элемента в массиве
	 * @param   {Array} array
	 * @param   {*}     value
	 * @returns {number}
	 * @private
	 */
	function _inArray(array, value) {
		var i = array.length;

		while (i--) {
			if (array[i] === value) {
				return i;
			}
		}

		return -1;
	}


	/**
	 * Выполнить команду
	 * @param {Hole}     hole
	 * @param {Object}   cmd
	 * @private
	 */
	function _execCmd(hole, cmd) {
		var fn = getOwn(hole, cmd.name);
		var next = function (err, result) {
			cmd.error = err;
			cmd.result = result;
			cmd.response = true;

//			console.log('emit.res.cmd', cmd.name);
			hole.emit('CMD', cmd);
		};


		try {
			if (typeof fn === 'function') {
				if (fn.length === 2) {
					// Предпологается асинхронная работа
					fn(cmd.data, next);
				} else {
					next(null, fn(cmd.data));
				}
			} else {
				throw 'method not found';
			}
		} catch (err) {
			next('wormhole.' + cmd.name + ': ' + err.toString());
		}
	}



	/**
	 * @class   Hole
	 * @extends Emitter
	 * @desc    «Дырка» — общение между табами
	 * @param   {url}     url
	 * @param   {Boolean} [useStore]  использовать store
	 */
	function Hole(url, useStore) {
		var _this = this;

		_this._destroyUnload = /* istanbul ignore next */ function () {
			_this.destroy();
		};


		/**
		 * Идентификатор
		 * @type {String}
		 */
		_this.id = uuid();


		/**
		 * Объект хранилища
		 * @type {store}
		 */
		_this.store;


		/**
		 * Название группы
		 * @type {String}
		 */
		_this.url = (url || document.domain);


		/**
		 * @type {String}
		 * @private
		 */
		_this._storePrefix = uuid.hash(_this.url);


		/**
		 * Внутренний индекс для события
		 * @type {Number}
		 * @private
		 */
		_this._idx;


		/**
		 * Очередь событий
		 * @type {Object[]}
		 * @private
		 */
		_this._queue = [];


		/**
		 * Очередь команд
		 * @type {Array}
		 * @private
		 */
		_this._cmdQueue = [];


		/**
		 * Объект функций обратного вызова
		 * @type {Object}
		 * @private
		 */
		_this._callbacks = {};


		_this._processingCmdQueue = debounce(_this._processingCmdQueue, 30);


		// Подписываемя на получение команд
		_this.on('CMD', function (cmd) {
			var id = cmd.id,
				cmdQueue = _this._cmdQueue,
				callback = _this._callbacks[id],
				idx = cmdQueue.length;

			if (cmd.response) {
				if (!_this.master) {
					// Мастер обработал команду, удаляем её из очереди
					while (idx--) {
						if (cmdQueue[idx].id === id) {
							cmdQueue.splice(idx, 1);
							break;
						}
					}
				}

				if (callback) {
					// О, это результат для наc
					delete _this._callbacks[id];
					callback(cmd.error, cmd.result);
				}
			}
			else {
				// Добавляем в очередь
				cmdQueue.push(cmd);
				_this._processingCmdQueue();
			}
		});


		// Опачки!
		_this.on('master', function () {
			_this._processingCmdQueue();
		});


		// Получи сторадж
		_this._initStorage(function (store) {
			_this.store = store;

			try {
				/* istanbul ignore next */
				if (!useStore && Worker.support) {
					_this._initSharedWorkerTransport();
				} else {
					throw "NOT_SUPPORTED";
				}
			} catch (err) {
				_this._initStorageTransport();
			}
		});


		/* istanbul ignore next */
		if (window.addEventListener) {
			window.addEventListener('unload', _this._destroyUnload);
		} else {
			window.attachEvent('onunload', _this._destroyUnload);
		}
	}



	Hole.fn = Hole.prototype = /** @lends Hole.prototype */{
		_attempt: 0,

		/**
		 * Готовность «дырки»
		 * @type {Boolean}
		 */
		ready: false,

		/**
		 * Мастер-флаг
		 * @type {Boolean}
		 */
		master: false,

		/**
		 * Уничтожен?
		 * @type {Boolean}
		 */
		destroyed: false,

		/**
		 * Кол-во «дырок»
		 * @type {Number}
		 */
		length: 0,


		on: Emitter.fn.on,
		off: Emitter.fn.off,


		/**
		 * Вызвать удаленную команду на мастере
		 * @param {String}    cmd
		 * @param {*}         [data]
		 * @param {Function}  [callback]
		 */
		call: function (cmd, data, callback) {
			if (typeof data === 'function') {
				callback = data;
				data = void 0;
			}

			// Генерируем id команды
			var id = uuid();

			this._callbacks[id] = callback;

			this.emit('CMD', {
				id: id,
				name: cmd,
				data: data,
				source: this.id
			});
		},


		/**
		 * Испустить событие
		 * @param   {String} type
		 * @param   {*}      [args]
		 * @returns {Hole}
		 */
		emit: function (type, args) {
			this._queue.push({ ts: now(), type: type, args: args });
			return this;
		},


		/**
		 * Инициализиция хранилища
		 * @private
		 */
		_initStorage: function (callback) {
			var _store = store,
				match = this.url.toLowerCase().match(/^(https?:)?\/\/([^/]+)/),
				ready = function _wait() {
					if (document.readyState === 'complete') {
						callback(_store);
					} else {
						setTimeout(_wait, 100);
					}
				};

			if (match && match[2] !== document.domain) {
				return store.remote(this.url, function (store) {
					_store = store;
					ready();
				});
			} else {
				ready();
				return store;
			}
		},


		/**
		 * Инициализация траспорта на основе SharedWorker
		 * @param  {Boolean}  [retry]  повтор
		 * @private
		 */
		_initSharedWorkerTransport: /* istanbul ignore next */ function (retry) {
			var _this = this,
				port,
				worker,
				url = _this.url,
				label = location.pathname + location.search,
				sharedUrl = _this._store('sharedUrl')
			;

			_this._attempt++;

//			console.log('try(' + _this._attempt + '):', label, retry, [sharedUrl, _this._prevUrl]);
			if (retry && (_this._prevUrl !== sharedUrl)) {
				retry = false;
			}
			_this._prevUrl = sharedUrl;

			try {
				sharedUrl = (retry || !sharedUrl) ? Worker.getSharedURL(url) : sharedUrl;

				_this.worker = (worker = Worker.create(sharedUrl));
				_this.port = (port = worker.port);

				_this._store('sharedUrl', sharedUrl);
//				console.log('new(' + _this._attempt + '):', label, [sharedUrl]);
			}
			catch (err) {
				if (_this._attempt > 3) {
					throw err;
				} else {
					_this._initSharedWorkerTransport(true);
				}
				return;
			}


			worker.addEventListener('error', function (err) {
//				console.log('error(' + _this._attempt + '):', label, [sharedUrl]);
				_this._initSharedWorkerTransport(true);
			}, false);


			_this.__onPortMessage = function (evt) { _this._onPortMessage(evt); };
			port.addEventListener('message', _this.__onPortMessage);
			port.start();
		},


		/**
		 * Сообщение от рабочего
		 * @param {Event} evt
		 * @private
		 */
		_onPortMessage: /* istanbul ignore next */ function (evt) {
			evt = evt.data;

			if (evt === 'CONNECTED') {
//				console.log(this.id, evt, this._store('sharedUrl'));

				this.emit = this._workerEmit;
				this.ready = true;
				this.port.postMessage({ hole: { id: this.id } });

				this._processingQueue();

				// Получили подтвреждение, что мы подсоединились
				_emitterEmit.call(this, 'ready', this);
			}
			else if (evt === 'PING') {
				// Ping? Pong!
				this.port.postMessage('PONG');
			}
			else if (evt === 'MASTER') {
				// Сказали, что мы теперь мастер
				this.master = true; // ОК
				_emitterEmit.call(this, 'master', this);
			}
			else if (evt.type === 'peers') {
				// Обновляем кол-во пиров
				this._updPeers(evt.data);
			}
			else {
//				console.log(this.id, evt.type);
				// Просто событие
				_emitterEmit.call(this, evt.type, evt.data);
			}
		},


		/**
		 * Инициализация транспорта на основе store
		 * @private
		 */
		_initStorageTransport: function () {
			var _this = this,
				_first = true,
				id = _this.id,
				_pidMeta;

			_this._idx = (_this._store('queue') || {}).idx || 0;


			// Реакция на обновление storage
			_this.__onStorage = function (key, data) {
				if (key.indexOf('peer.') > -1) {
					//console.log('onPeer:', key, data[key]);
					_this._updPeers();

					clearTimeout(_pidMeta);
					if (_first) {
						_first = false;

						// Размазываем проверку по времени
						_pidMeta = setTimeout(_this._checkMetaDelayed, 500);

						// Только сейчас запускаем проверку обновления meta и peer
						_this._pid = setInterval(function () {
							_this._checkMeta(true);
							_this._store('peer.' + id, now());
						}, UPD_META_DELAY);
					}
				}
				else if (key === _this._storeKey('queue')) {
					_this._processingQueue(data[key].items);
				}
				else if (key === _this._storeKey('meta')) {
					_this._checkMetaDelayed();
				}
			};


			_this._checkMetaDelayed = function (upd) {
				//console.log('_checkMetaDelayed:', now());
				_this._checkMeta(upd);
			};


			_this.store.on('change', _this.__onStorage);

			// Разрыв для нормальной работы синхронной подписки на события (из вне)
			_this._pid = setTimeout(function () {
				_this.emit = _this._storeEmit;
				_this.ready = true;

				_emitterEmit.call(_this, 'ready', _this);

				_this._store('peer.' + id, now());
				_this._processingQueue();
			}, 0);
		},



		/**
		 * Проверка мета данных
		 * @param  {boolean}  [upd]
		 * @private
		 */
		_checkMeta: function (upd) {
			var ts = now(),
				meta = this._store('meta') || { id: 0, ts: 0 },
				id = this.id,
				emitMasterEvent = false
			;


			// Проверяем master: быть или не быть
			/* istanbul ignore else */
			if ((!meta.id || (ts - meta.ts) > MASTER_DELAY) || (meta.id == id && !this.master)) {
				//console.log('check.master: ' + id + ' === ' + meta.id + '? delta: ' + (ts - meta.ts), this.master);

				upd = true;
				meta.id = id;
				emitMasterEvent = true;
				this.master = true;
			}

			if (upd) {
				if (this.master) {
					//console.log('master.upd: ' + this.id + ', delta: ' + (ts - meta.ts));

					meta.ts = ts;
					this._store('meta', meta);
					emitMasterEvent && _emitterEmit.call(this, 'master', this);
				}
			}
		},


		/**
		 * Получить все активные «дыкрки»
		 * @return {Array}
		 */
		getPeers: function (withoutId) {
			var ts = now(),
				_this = this,
				peers = [],
				storeKey = _this._storeKey('peer.');

			_this.store.each(function (value, key) {
				if (key.indexOf(storeKey) > -1) {
					if ((ts - value) < PEERS_DELAY) {
						peers.push(key.substr(storeKey.length));
					}
					else if (_this.master) {
						_this.store.remove(key);
					}
				}
			});

			return peers;
		},


		/**
		 * Обновляем кол-во и список «дырок»
		 * @param  {string[]}  [peers]
		 * @private
		 */
		_updPeers: function (peers) {
			var i,
				id,
				ts = now(),
				_this = this,
				_peers = _this._peers || [],
				changed = false;

			if (!peers) {
				peers = this.getPeers();
			}

			i = Math.max(peers.length, _peers.length);
			while (i--) {
				id = peers[i];

				if (id && _inArray(_peers, id) === -1) {
					changed = true;
					_emitterEmit.call(this, 'peers:add', id);
				}

				if (_peers[i] != id) {
					id = _peers[i];

					if (id && _inArray(peers, id) === -1) {
						changed = true;
						_emitterEmit.call(this, 'peers:remove', id);
					}
				}
			}

			if (changed) {
				this._peers = peers;
				this.length = peers.length;
				_emitterEmit.call(this, 'peers', [peers]);
			}
		},


		/**
		 * Получить ключь для store
		 * @param   {String}  key
		 * @returns {String}
		 * @private
		 */
		_storeKey: function (key) {
			return this._storePrefix + '.' + key;
		},


		/**
		 * Записать или получить информацию из хранилища
		 * @param   {String}  key
		 * @param   {*}       [value]
		 * @returns {Object}
		 * @private
		 */
		_store: function (key, value) {
			key = this._storeKey(key);

			if (value === null) {
				this.store.remove(key);
			}
			else if (value === void 0) {
				value = this.store.get(key);
			}
			else {
				this.store.set(key, value);
			}

			return value;
		},


		/**
		 * Emit через SharedWorker
		 * @param type
		 * @param args
		 * @private
		 */
		_workerEmit: /* istanbul ignore next */ function (type, args) {
			var ts = now();

			this.port.postMessage({
				ts: ts,
				type: type,
				data: args
			});

			return this;
		},


		/**
		 * Emit через хранилище
		 * @param type
		 * @param args
		 * @private
		 */
		_storeEmit: function (type, args) {
			var queue = this._store('queue') || { items: [], idx: 0 },
				ts = now(),
				items = queue.items,
				i = items.length
			;

			items.push({
				ts: ts,
				idx: ++queue.idx,
				type: type,
				args: args,
				source: this.id
			});

			while (i--) {
				if (ts - items[i].ts > QUEUE_WAIT) {
					items.splice(0, i);
					break;
				}
			}

			this._store('queue', queue);
			this._processingQueue(queue.items);

			return this;
		},


		/**
		 * Обработка очереди событий
		 * @param  {Object[]} [queue]
		 * @private
		 */
		_processingQueue: function (queue) {
			var evt;

			if (queue === void 0) {
				queue = this._queue;

				while (queue.length) {
					evt = queue.shift();
					this.emit(evt.type, evt.args);
				}
			}
			else {
				for (var i = 0, n = queue.length; i < n; i++) {
					evt = queue[i];

					if (this._idx < evt.idx) {
						this._idx = evt.idx;

//						if (evt.source !== this.id) {
							_emitterEmit.call(this, evt.type, evt.args);
//						}
					}
				}
			}
		},


		/**
		 * Обработка очереди команд
		 * @private
		 */
		_processingCmdQueue: function () {
			var cmdQueue = this._cmdQueue;

			/* istanbul ignore else */
			if (this.master) {
				while (cmdQueue.length) {
					_execCmd(this, cmdQueue.shift());
				}
			}
		},


		/**
		 * Уничтожить
		 */
		destroy: function () {
			if (!this.destroyed) {
				if (window.addEventListener) {
					window.removeEventListener('unload', this._destroyUnload);
				} else {
					window.detachEvent('onunload', this._destroyUnload);
				}

				this.ready = false;
				this.destroyed = true;
				this._destroyUnload = null;

				clearTimeout(this._pid);

				// Описываем все события
				this.off();
				store.off('change', this.__onStorage);

				/* istanbul ignore next */
				if (this.port) {
					this.port.removeEventListener('message', this.__onPortMessage);
					this.port.postMessage('DESTROY');
					this.port = null;
					this.worker = null;
				}
				else {
					this._store('peer.' + this.id, null);

					/* istanbul ignore else */
					if (this.master) {
						// Если я мастер, удаляем инфу об этом или назначаем последний открытий таб
						var meta = null,
							nextId = this.getPeers().pop();

						if (nextId) {
							meta = {
								id: nextId,
								ts: this._store('peer.' + nextId)
							};
						}

						this._store('meta', meta);
//						console.log('master destroyed');
					}
				}

				this.master = false;
			}
		}
	};


	

	var singletonHole = function () {
		/* istanbul ignore else */
		if (!singletonHole.instance) {
			singletonHole.instance = new Hole();
		}

		return singletonHole.instance;
	};


	Worker.support &= (window.wormhole && wormhole.workers);


	// Export
	singletonHole.version = '0.7.2';
	singletonHole.now = now;
	singletonHole.uuid = uuid;
	singletonHole.debounce = debounce;
	singletonHole.cors = cors;
	singletonHole.store = store;
	singletonHole.Emitter = Emitter;
	singletonHole.Worker = Worker;

	singletonHole.Hole = Hole;
	singletonHole.Universal = Hole;


	/* istanbul ignore next */
	if (typeof define === 'function' && define.amd) {
		define(function () { return singletonHole; });
	}
	else if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
		module.exports = singletonHole;
	}
	else {
		window.wormhole = singletonHole;
	}
})(window, document);