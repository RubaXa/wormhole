useRemoteServer && (function () {
	module('wormhole.cors');


	// Взаимодействие с удаленным сервером
	asyncTest('cors', function () {
		var cors = wormhole.cors;


		// Создаем два iframe
		$.when(_createWin(), _createWin()).then(function (foo, bar) {
			var log = [];

			// Подписываемся по получение данных в текущем окне
			cors.on('data', function (data) {
				log.push(data);
			});

			// Отправляем данные в iframe
			cors(foo).send("Wow");

			// Определим команды, которые может вызвать удаленный сервер
			cors.well = function (data) {
				log.push('well ' + data);
			};

			// Команда с ошибокй
			cors.fail = function () {
				throw "error";
			};

			// Вызываем удаленную команду у iframe
			cors(bar).call('remote', { value: 321 }, function (err, response) {
				log.push(response);
			});

			// Вызываем неопределенную команду
			cors(bar).call('unknown', function (err) {
				log.push(err);
			});

			// Команду с ошибкой
			cors(bar).call('fail', function (err) {
				log.push(err);
			});

			// Проверям результат
			setTimeout(function () {
				deepEqual(log, [
					'Wow!',
					'well done',
					{ bar: true, value: 642 },
					'wormhole.cors.unknown: method not found',
					'wormhole.cors.fail: remote error'
				]);
				start();
			}, 100);
		});
	});


})();
