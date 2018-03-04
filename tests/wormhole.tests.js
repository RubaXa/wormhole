(function () {
	QUnit.module('wormhole');


	QUnit.test('core', function (assert) {
		var log = [0, 0, 0];
		var holes = [];
		var _set = function (i) {
			assert.ok(true, '#' + i);
			log[i] = 1;
		};
		var done = assert.async();


		var hole = wormhole().on('foo', function () {
			_set(0);
		});
		holes.push(hole);


		_createWin('local.test.html').then(function (el) {
			var hole = el.contentWindow.wormhole().on('foo', function () {
				_set(1);
			});
			holes.push(hole);
		});

		_createWin('local.test.html').then(function (el) {
			var hole = el.contentWindow.wormhole().on('foo', function () {
				_set(2);
			});
			holes.push(hole);
		});


		_createWin('local.test.html').then(function (el) {
			var hole = el.contentWindow.wormhole().emit('foo');
			holes.push(hole);
		});


		setTimeout(function () {
			assert.deepEqual(log, [1, 1, 1]);
			$.each(holes, function (i, hole) {
				hole.destroy();
			});
			done();
		}, 1000);
	});
})();
