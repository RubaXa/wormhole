(function () {
	module('wormhole');


	asyncTest('core', function () {
		var log = [0, 0, 0],
			holes = [],
			_set = function (i) {
				ok(true, '#' + i);
				log[i] = 1;
			};


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
			deepEqual(log, [1, 1, 1]);
			$.each(holes, function (i, hole) {
				hole.destroy();
			});
			start();
		}, 1000);
	});
})();
