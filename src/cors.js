define(["./emitter", "./get-own"], function (Emitter, getOwn) {
	var _corsId = 1,
		_corsExpando = '__cors__',
		_corsCallback = {},
		_parseJSON = JSON.parse,
		_stringifyJSON = JSON.stringify,
		_allowAccess = void 0
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
	 * Разрешение для конкретного `origin`
	 * @param {*} origin
	 */
	cors.allowAccess = function (origin) {
		if (typeof origin === 'string' || origin instanceof RegExp) {
			_allowAccess = origin;
		}
	};

	/**
	 * Установка кастомного префикса `expando`
	 * @param {String} expando
	 */
	cors.setExpando = function (expando) {
		if (typeof expando === 'string') {
			_corsExpando = expando;
		}
	};



	

	/**
	 * Проверка на соответствие `targetOrigin`
	 * @param {*} targetOrigin
	 * @private
	 */
	function _checkAccess(targetOrigin) {
		if (_allowAccess == void 0) {
			return true;
		} else if (_allowAccess instanceof RegExp) {
			return _allowAccess.test(targetOrigin);
		} else if (typeof _allowAccess === 'string') {
			return targetOrigin === _allowAccess;
		}

		return false;
	}

	/**
	 * Получение `postMessage`
	 * @param {Event} evt
	 * @private
	 */
	function _onmessage(evt) {
		var origin,
			id,
			resp = {},
			data = evt.data,
			source = evt.source,
			func;

		evt = evt || /* istanbul ignore next */ window.event;
		origin = evt.origin || evt.originalEvent.origin;

		/* istanbul ignore else */
		if (typeof data === 'string' && data.indexOf(_corsExpando) === 0 && _checkAccess(origin)) {
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


	// Export
	return cors;
});
