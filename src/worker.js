define(["./debounce"], function (debounce) {
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
		 * @param   {String} id
		 * @returns {String}
		 * @private
		 */
		getSharedURL: function (id) {
			// Код воркера
			var source = '(' + (function (window, debounce) {
				var ports = [];
				var master = null;

				var checkMaster = function () {
					if (!master && (ports.length > 0)) {
						master = ports[0];
						master.postMessage('MASTER');
					}
				};

				var broadcast = function (data) {
					ports.forEach(function (port) {
						port.postMessage(data);
					});
				};

				var removePort = function (port) {
					var idx = ports.indexOf(port);

					if (port === master) {
						master = null;
					}

					if (idx > -1) {
						port.postMessage('REMOVED');
						ports.splice(idx, 1);
						peersUpdated();
					}
				};

				var peersUpdated = debounce(function () {
					checkMaster();
					broadcast({
						type: 'peers',
						data: ports.reduce(function (peers, port) {
							port.holeId && peers.push(port.holeId);
							return peers;
						}, [])
					});
				}, 300);

				var pingService = function () {
					var ts = Date.now();

					ports.forEach(function (port) {
						var delta = ts - port.lastActivity;

						if (delta > 15000) {
							// Убиваем зомби
							removePort(port);
						} else if (delta >= 1000) {
							setTimeout(ping, 0, port);
						}
					});

					setTimeout(pingService, 1000);
				};

				var ping = function (port) {
					if (port.pingPong) {
						port.pingPong = false; // помечаем порт как не активный
						// port.pingTime = Date.now();
						port.postMessage('PING');
					}
				};

				window.addEventListener('connect', function (evt) {
					evt.ports.forEach(function (port) {
						ports.push(port);

						port.pingPong = true; // любая активность порта
						port.lastActivity = Date.now();

						port.onmessage = function (evt) {
							var data = evt.data;

							port.pingPong = true;
							port.lastActivity = Date.now();

							if (data === 'PONG') {
								// Ничего не делаем
								// port.postMessage({
								// 	type: 'PONG',
								// 	detail: Date.now() - port.pingTime,
								// })
								if (ports.indexOf(port) > -1) {
									ports.push(port);
									port.postMessage('ADDED');
								}
							} else if (data === 'DESTROY') {
								// Удаляем порт
								removePort(port);
							} else if (data.hole) {
								// Обновление meta информации
								port.holeId = data.hole.id;
								peersUpdated();
							} else {
								broadcast({
									type: data.type,
									data: data.data
								});
							}
						};

						port.start();
						port.postMessage('CONNECTED');
						checkMaster();
					});
				}, false);

				pingService();
			}).toString() + ')(' + [
				'this',
				debounce.toString(),
				_stringifyJSON(name)
			] + ')';

			return URL.createObjectURL(new Blob([source], {type: 'text/javascript'}));
		}
	};


	// Export
	return Worker;
});
