define(["now", "uuid", "debounce", "emitter", "store", "worker"], function (now, uuid, debounce, Emitter, store, Worker) {
	var MASTER_DELAY = 1000, // ms
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
		_this._idx = _this._store('idx') || 0;


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
//				console.log(this.id, evt);
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
		 * Инициализация траспорта на основе sessionStorage
		 * @private
		 */
		_initStorageTransport: function () {
			var _this = this;

			_this.__onStorage = function () {
				_this._onStorage();
			};

			// Разрыв для нормальной работы синхронной подписки на события
			_this._pid = setTimeout(function _tick() {
				_this.emit = _this._storeEmit;
				_this.connected = true;

				store.on('change', _this.__onStorage);
				_emitterEmit.call(_this, 'connect', _this);

				_this._processingQueue(); // первый раз синхронно
				_this._processingQueue = debounce(_this._processingQueue, 30);

				_this._onStorage();

				_this._pid = setInterval(_this.__onStorage, MASTER_DELAY/2);
			}, 0);
		},


		/**
		 * Записать или получить информацию из хранилища
		 * @param   {String}  key
		 * @param   {*}       [value]
		 * @returns {Object}
		 * @private
		 */
		_store: function (key, value) {
			key = this._storePrefix + '.' + key;

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
			var idx = this._store('idx') || 0,
				queue = this._store('queue') || [],
				ts = now();

			queue.push({
				ts: ts,
				idx: ++idx,
				type: type,
				args: args,
				source: this.id
			});

			this._store('idx', idx);
			this._store('queue', queue);

			_emitterEmit.call(this, type, args);

			return this;
		},


		/**
		 * Проверка изменений в хранилище
		 * @private
		 */
		_onStorage: function () {
			var ts = now(),
				queue = this._store('queue'),
				master = this._store('master')
			;

//			console.log('_onStorage:', this.id, this._storePrefix, JSON.stringify(master));

			/* jshint eqnull:true */
			if (master == null) {
				master = { ts: 0, id: 0 };
			}


			// Проверяем master, жив он или нет
			/* istanbul ignore else */
			if ((ts - master.ts) > MASTER_DELAY || this.master) {
				if (master.id != this.id) {
//					console.log('set.master:', this.id, ts - master.ts, ts);

					master.id = this.id;
					this.master = true;

					_emitterEmit.call(this, 'master', this);
				}

//				console.log('check.master:', this.id, ts - master.ts, ts);
				master.ts = ts;
				this._store('master', master);
			}

			/* istanbul ignore else */
			if (queue) {
//				console.log(this.id, this._idx, queue);
				this._processingQueue(queue);
			}
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

						if (evt.source !== this.id) {
							_emitterEmit.call(this, evt.type, evt.args);
						}
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
				this.master = false;
				this._store('master', null);
			}
		}
	};


	// Export
	return Hole;
});
