define(["emitter", "store"], function (emitter, store) {
	var WORKER_STORE_PREFIX = '__worker__.',

		_parseJSON = JSON.parse,
		_stringifyJSON = JSON.stringify
	;

	/**
	 * @type {URL}
	 */
	var URL = window.URL;


	/**
	 * @type {Blob}
	 */
	var Blob = URL && window.Blob;


	/**
	 * @type {SharedWorker}
	 */
	var SharedWorker = Blob && window.SharedWorker;


	/**
	 * @type {string}
	 * @const
	 */
	var PING_SIGNAL = 'PING';


	/**
	 * Создать воркер
	 * @param   {String} name
	 * @returns {String}
	 * @private
	 */
	function _createSharedWorkerURL(name) {
		// Код воркера
		var source = '(' + (function (window) {
			var ports = [];


			function broadcast(data) {
				ports.forEach(function (port) {
					port.postMessage(data);
				});
			}


			function peersUpdated() {
				broadcast({ type: 'peers', data: ports.length });
			}


			window.addEventListener('connect', function (event) {
				var port = event.ports[0];

				ports.push(port);

				port.onmessage = function (evt) {
					var data = evt.data;

					if (data === PING_SIGNAL) {
						var idx = ports.indexOf(evt.target);

						if (idx !== -1) {
							ports.splice(idx, 1);
							peersUpdated();
						}
					} else {
						broadcast({ type: 'message', data: data });
					}
				};

				port.start();
				peersUpdated();
			}, false);
		}).toString() + ')(this, ' + _stringifyJSON(name) + ')';

		return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
	}


	/**
	 * Получить/установить путь к воркеру по его имени
	 * @param   {String} name
	 * @param   {String} [url]
	 * @returns {String|undefined}
	 * @private
	 */
	function _workerURL(name, url) {
		url = store[url ? 'set' : 'get'](WORKER_STORE_PREFIX + name, url);
		return url;
	}



	/**
	 * @class   Worker
	 * @extends emitter
	 * @desc    Обертка над SharedWorker c деградацией до sessionStorage
	 * @param   {Object} options  найстройки
	 */
	function Worker(options) {
		if (typeof options === 'string') {
			options = { name: options }
		}
		else {
			options = options || {};
		}


		/**
		 * Название группы
		 * @type {String}
		 */
		this.name = options.name || '__globals__';

		try {
			this._initSharedWorkerTransport();
		} catch (err) {
			this._initStorageTransport();
		}
	}



	Worker.fn = Worker.prototype = emitter.apply(/** @lends Worker.prototype */{
		_attempt: 0,

		/**
		 * Испустить событие
		 * @param {String} type
		 * @param {*}      [args]
		 */
		emit: function (type, args) {
			this.port.postMessage({
				type: type,
				data: args
			});
		},


		_initSharedWorkerTransport: function (retry) {
			var port,
				worker,
				name = this.name,
				url = _workerURL(name),
				label = location.pathname + location.search
			;

			this._attempt++;

//			console.log('try(' + this._attempt + '):', label, retry, [url, this._prevUrl]);

			if (retry && (this._prevUrl !== url)) {
				retry = false;
			}
			this._prevUrl = url;

			try {
				url = (retry || !url) ? _createSharedWorkerURL(name) : url;
				worker = new SharedWorker(url);
				this.port = (port = worker.port);

				_workerURL(name, url);
//				console.log('new(' + this._attempt + '):', label, [url]);
			}
			catch (err) {
				if (this._attempt > 3) {
					throw err;
				} else {
					this._initSharedWorkerTransport(true);
				}
				return;
			}


			worker.addEventListener('error', function (err) {
//				console.log('error(' + this._attempt + '):', label, [url]);
				this._initSharedWorkerTransport(true);
			}.bind(this), false);


			port.addEventListener('message', function (evt) {
				evt = evt.data;
				emitter.fn.emit.call(this, evt.type, evt.data);
//				console.log([label, url], evt);
			}.bind(this));


			port.start();

			// Пингуем
			setInterval(function () {
				this.port.postMessage(PING_SIGNAL);
			}.bind(this), 30000);
		}

	});



	// Export
	return Worker;
});
