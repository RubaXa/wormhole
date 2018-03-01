define(["./now", "./uuid", "./debounce", "./emitter", "./store", "./worker", "./get-own"], function (now, uuid, debounce, Emitter, store, Worker, getOwn) {
	var PEER_UPD_DELAY = 5 * 1000, // ms, как часто обновлять данные j gbht
		MASTER_VOTE_DELAY = 500, // ms, сколько времени считать мастер живым
		MASTER_DELAY = PEER_UPD_DELAY * 2, // ms, сколько времени считать мастер живым
		PEERS_DELAY = PEER_UPD_DELAY * 4, // ms, сколько времени считать peer живым
		QUEUE_WAIT = PEER_UPD_DELAY * 2, // ms, за какой период времени держать очередь событий

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
		 * Список уже попробованных sharedUrl
		 * @type {Object}
		 * @private
		 */
		_this._excludedSharedUrls = {};


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
			var match = this.url.toLowerCase().match(/^(https?:)?\/\/([^/]+)/);;

			if (match && match[2] !== document.domain) {
				store.remote(this.url, callback);
			} else {
				callback(store);
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
				sharedUrls = _this._getSharedUrls(),
				surl = sharedUrls[0],
				sid
			;

			_this._store('shared.url.' + _this.id, null);
			_this._attempt++;

			if (_this._attempt > 10) {
				return;
			}

			try {
				if (!surl) {
					sid = url + ':' + _this.id;
					surl = Worker.getSharedURL(sid);
				}

				_this._excludedSharedUrls[surl] = true;
				_this.worker = (worker = Worker.create(surl));
				_this.port = (port = worker.port);

				_this._store('shared.url.' + _this.id, {
					url: url,
					surl: surl,
				});
			}
			catch (err) {
				console.warn('[wormhole] Worker error:', err);
				_this._initSharedWorkerTransport(true);
			}

			_this.__onPortMessage = function (evt) {
				_this._onPortMessage(evt);
			};

			_this.__onWorkerError = function (evt) {
				console.warn('[wormhole] Worker error:', evt);
				worker.removeEventListener('error', _this.__onWorkerError, false);
				worker = null;
				_this._initSharedWorkerTransport(true);
			};

			worker.addEventListener('error', _this.__onWorkerError, false);
			port.addEventListener('message', _this.__onPortMessage);
			port.start();
		},

		_getSharedUrls: function () {
			var _this = this;
			var surls = [];
			var prefix = this._storeKey('shared.url');

			this.store.each(function (data, key) {
				if (
					key.indexOf(prefix) !== -1 &&
					data.url === _this.url &&
					!_this._excludedSharedUrls[data.surl]
				) {
					surls.push(data.surl);
				}
			});

			return surls;
		},

		/**
		 * Сообщение от рабочего
		 * @param {Event} evt
		 * @private
		 */
		_onPortMessage: /* istanbul ignore next */ function (evt) {
			evt = evt.data;

			if (evt === 'CONNECTED') {
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
				this._checkPeers(evt.data);
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
				id = _this.id;

			_this._idx = (_this._store('queue') || {}).idx || 0;

			// Запускаем проверку обновления данных peer'а
			_this._updPeer = function () {
				_this._store('peer.' + id, {
					id: id,
					ts: now(),
					master: _this.master,
				});

				clearTimeout(_this._pid);
				_this._pid = setTimeout(_this._updPeer, PEER_UPD_DELAY);
			};

			// Реакция на обновление storage
			_this.__onStorage = function (key, data) {
				if (key.indexOf('peer.') > -1) {
					//console.log('onPeer:', key, data[key]);
					_this._checkPeers();

					// Размазываем проверку по времени
					clearTimeout(_this._pidMaster);
					_this._pidMaster = setTimeout(_this._checkMasterDelayed, MASTER_VOTE_DELAY);
				}
				else if (key === _this._storeKey('queue')) {
					_this._processingQueue(data[key].items);
				}
			};

			_this._checkMasterDelayed = function () {
				_this._checkMaster();
			};

			_this.store.on('change', _this.__onStorage);

			// Разрыв для нормальной работы синхронной подписки на события (из вне)
			_this._pid = setTimeout(function () {
				_this.emit = _this._storeEmit;
				_this.ready = true;

				_emitterEmit.call(_this, 'ready', _this);

				_this._updPeer();
				_this._processingQueue();
			}, 0);
		},



		/**
		 * Проверка и выбор мастера
		 * @private
		 */
		_checkMaster: function () {
			var peers = this.getPeers(true);

			if (peers.length > 0) {
				var mpeer = peers[0];

				if (!mpeer.master || (now() - mpeer.ts) > MASTER_DELAY) {
					peers.forEach(function (p) {
						if (mpeer.ts < p.ts) {
							mpeer = p;
						}
					});

					if (mpeer.id === this.id) {
						this.master = true;
						this._updPeer();
						_emitterEmit.call(this, 'master', this);
					}
				}
			}
		},


		/**
		 * Получить все активные «дыкрки»
		 * @param  {boolean} [raw]
		 * @return {Array}
		 */
		getPeers: function (raw) {
			var ts = now(),
				_this = this,
				peers = [],
				storeKey = _this._storeKey('peer.');

			_this.store.each(function (data, key) {
				if (key.indexOf(storeKey) > -1) {
					if ((ts - data.ts) < PEERS_DELAY) {
						if (raw) {
							peers[data.master ? 'unshift' : 'push'](data);
						} else {
							peers.push(data.id);
						}
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
		_checkPeers: function (peers) {
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
				this._store('shared.url.' + this.id, null);

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
				}

				this.master = false;
			}
		}
	};


	// Export
	return Hole;
});
