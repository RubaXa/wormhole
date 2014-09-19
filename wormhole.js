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
		 * @returns {emitter}
		 */
		off: function (name, fn) {
			if (name === void 0) {
				delete this[__emitter__];
			}
			else {
				var listeners = getListeners(this, name),
					i = listeners.length;

				while (i--) {
					// Ищем слушателя и удаляем (indexOf - IE > 8)
					if (listeners[i] === fn) {
						listeners.splice(i, 1);
						break;
					}
				}
			}

			return this;
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

			args = (arguments.length === 0) ? [] : [].concat(args);
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
		target.emit = Emitter.fn.emit;

		return target;
	};


	Emitter.getListeners = getListeners;


	

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

		try {
			// Если это iframe
			el = el.contentWindow || /* istanbul ignore next */ el;
		} catch (err) {}

		this.window = el;
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
			this.window.postMessage(_corsExpando + _stringifyJSON(data), '*');
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
		if (data.indexOf(_corsExpando) === 0) {
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
							func = cors[data.cmd];

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
					if (!master && ports[0]) {
						master = ports[0];
						master.postMessage('MASTER');
					}
				}


				function broadcast(data) {
					ports.forEach(function (port) {
						port.postMessage(data);
					});
				}


				function peersUpdated() {
					broadcast({ type: 'peers', data: ports.length });
				}


				// Опришиваем и ищем зомби
				setInterval(function () {
					var i = ports.length, port;

					while (i--) {
						port = ports[i];

						if (port.zombie) {
							// Убиваем зомби
							if (port === master) {
								master = null;
							}

							ports.splice(i, 1);
							peersUpdated();
						}
						else {
							port.zombie = true; // Помечаем как зомби
							port.postMessage('PING');
						}
					}

					checkMaster();
				}, 300);


				window.addEventListener('connect', function (evt) {
					var port = evt.ports[0];

					port.onmessage = function (evt) {
						var data = evt.data;

						if (data === 'PONG') {
							port.zombie = false; // живой порт
						}
						else if (data === 'DESTROY') {
							port.zombie = true;
						}
						else {
							broadcast({ type: data.type, data: data.data });
						}
					};

					ports.push(port);

					port.start();
					port.postMessage('CONNECTED');

					checkMaster();
					peersUpdated();
				}, false);
			}).toString() + ')(this, ' + _stringifyJSON(name) + ')';

			return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
		}
	};


	

	var MASTER_DELAY = 1000, // ms
		UPD_META_DELAY = MASTER_DELAY / 2, // ms
		PEERS_DELAY = 5 * 1000, // ms
		QUEUE_WAIT = 5 * 1000, // ms время сколько держать очередь

		_emitterEmit = Emitter.fn.emit
	;


	/**
	 * Выполнить команду
	 * @param {Hole}     hole
	 * @param {Object}   cmd
	 * @private
	 */
	function _execCmd(hole, cmd) {
		var fn = hole[cmd.name];
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
		var _this = this,
			_destroy = /* istanbul ignore next */ function () {
				_this.destroy();
			};


		/**
		 * Идентификатор
		 * @type {String}
		 */
		_this.id = uuid();


		/**
		 * Название группы
		 * @type {String}
		 */
		_this.url = (url || document.domain);


		/**
		 * @type {String}
		 * @private
		 */
		_this._storePrefix = '__hole__.' + uuid.hash(_this.url);


		/**
		 * Внутренний индекс для события
		 * @type {Number}
		 * @private
		 */
		_this._idx = (_this._store('queue') || {}).idx || 0;


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


		/* istanbul ignore next */
		if (window.addEventListener) {
			window.addEventListener('unload', _destroy);
		} else {
			window.attachEvent('onunload', _destroy);
		}
	}



	Hole.fn = Hole.prototype = /** @lends Hole.prototype */{
		_attempt: 0,

		/**
		 * Статус подключения
		 * @type {Boolean}
		 */
		connected: false,

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
				this.connected = true;
				this._processingQueue();

				// Получили подтвреждение, что мы подсоединились
				_emitterEmit.call(this, 'connect', this);
			}
			else if (evt === 'PING') {
				// Тук-тук?
				this.port.postMessage('PONG');
			}
			else if (evt === 'MASTER') {
				// Сказали, что мы теперь мастер
				this.master = true; // ОК
				_emitterEmit.call(this, 'master', this);
			}
			else {
//				console.log(this.id, evt.type);
				// Просто событие
				_emitterEmit.call(this, evt.type, evt.data);
			}
		},


		/**
		 * Инициализация траспорта на основе store
		 * @private
		 */
		_initStorageTransport: function () {
			var _this = this;

			// Реакция на обновление storage
			_this.__onStorage = function (key, data) {
				if (key === _this._storeKey('queue')) {
					_this._processingQueue(data[key].items);
				}
				else if (key === _this._storeKey('meta')) {
					_this._checkMeta();
				}
			};

			// Обновить мета данные
			_this.__updMeta = function () {
				_this._checkMeta(true);
			};

			store.on('change', _this.__onStorage);

			// Разрыв для нормальной работы синхронной подписки на события
			_this._pid = setTimeout(function _tick() {
				_this.emit = _this._storeEmit;
				_this.connected = true;

				_emitterEmit.call(_this, 'connect', _this);

				_this._checkMeta();
				_this._processingQueue();

				_this._pid = setInterval(_this.__updMeta, UPD_META_DELAY);
			}, 0);
		},



		/**
		 * Проверка мета данных
		 * @param  {Boolean}  [upd]
		 * @private
		 */
		_checkMeta: function (upd) {
			var ts = now(),
				meta = this._store('meta') || { id: 0, ts: 0, peers: {} },
				peers = meta.peers,
				id = this.id,
				peersCount = 0
			;


			// Посчитаем кол-во peers
			peers[id] = ts;


			for (id in peers) {
				if ((ts - peers[id]) > PEERS_DELAY) {
					delete peers[id];
				} else {
					peersCount++;
				}
			}


			// Обновляем кол-во пиров
			if (this.length !== peersCount) {
				this.length = peersCount;
				_emitterEmit.call(this, 'peers', peersCount);
			}



			// Проверяем master, жив он или нет
			/* istanbul ignore else */
			if ((ts - (meta.ts||0)) > MASTER_DELAY || this.master) {
				if (meta.id != this.id) {
//					console.log('set.master:', this.id, ts - meta.ts, ts);

					upd = true;
					meta.id = this.id;
					this.master = true;

					_emitterEmit.call(this, 'master', this);
				}

				meta.ts = ts;
//				console.log('check.master:', this.id, ts - meta.ts, ts);
			}


			if (upd) {
				this._store('meta', meta);
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

			if (value === void 0) {
				value = store.get(key);
			}
			else {
				store.set(key, value);
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
			var meta = this._store('meta') || {};

			clearTimeout(this._pid);
			clearInterval(this._pid);

			this.connected = false;
			this.destroyed = true;

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

			/* istanbul ignore else */
			if (this.master) {
				// Если я мастер, удаляем инфу об этом
				meta.ts = 0;
				this.master = false;
			}

			if (meta.peers) {
				delete meta.peers[this.id];
			}

			meta.peers = meta.peers || {};
			this._store('meta', meta);
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
	singletonHole.version = '0.2.0';
	singletonHole.now = now;
	singletonHole.uuid = uuid;
	singletonHole.debounce = debounce;
	singletonHole.cors = cors;
	singletonHole.store = store;
	singletonHole.Emitter = Emitter;
	singletonHole.Hole = Hole;
	singletonHole.Worker = Worker;


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