(function (wormhole) {
	QUnit.module('wormhole.Universal');


	QUnit.test('peers', function (assert) {
		var rnd = Math.random();
		var log = [];
		var hole = new wormhole.Universal('http://localhost:4791/universal.html', true);
		var done = assert.async();

		hole.on('local', function (val) {
			assert.ok(true, 'local: ' + val);
			log.push(val);
		});

		hole.emit('local', 1);

		_createWin('remote:universal.test.html').always(function () {
			setTimeout(function () {
				console.log('hole.emit(remote, ' + rnd + ')');
				hole.emit('remote', rnd);

				setTimeout(function () {
					deepEqual(log, [1, 2, rnd + '!'], 'remote -> local');
					done();
				}, 50);
			}, 500);
		});
	});
})(wormhole);
