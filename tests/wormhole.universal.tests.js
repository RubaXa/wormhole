(function (wormhole) {
	module('wormhole.Universal');


	asyncTest('peers', function () {
		var rnd = Math.random(),
			log = [],
			hole = new wormhole.Universal('http://localhost:4791/universal.html', true);

		hole.on('local', function (val) {
			ok(true, 'local: ' + val);
			log.push(val);
		});

		hole.emit('local', 1);

		_createWin('remote:universal.test.html').always(function () {
			setTimeout(function () {
				console.log('hole.emit(remote, ' + rnd + ')');
				hole.emit('remote', rnd);

				setTimeout(function () {
					deepEqual(log, [1, 2, rnd + '!'], 'remote -> local');
					start();
				}, 50);
			}, 500);
		});
	});
})(wormhole);
