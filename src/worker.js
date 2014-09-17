define([], function () {
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
		support: URL && Blob && SharedWorker,


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


	// Export
	return Worker;
});
