(function _tryAgainTest(useStore) {
	module('wormhole.Hole.' + (useStore ? 'store' : 'worker'));


	function newHole(el, url) {
		var Hole = wormhole.Hole;

		if (el) {
			Hole = (el.contentWindow && el.contentWindow.wormhole.Hole) || el.wormhole.Hole;
		}

		return new Hole(url || 'local.test.html', useStore);
	}


	asyncTest('core', function () {
		var log = [];
		var fooLog = [];
		var main = newHole();


		main
			.emit('xxx')
			.on('connect', function (hole) {
				if (useStore) {
					ok(hole.emit === hole._storeEmit, 'sotreEmit');
				} else {
					ok(hole.worker instanceof window.SharedWorker, 'instanceof');
					ok(hole.emit === hole._workerEmit, 'workerEmit');
				}

				log.push('connect:' + hole.id);
			})
			.on('master', function (hole) { log.push('master:' + hole.id); })
		;


		_createWin('local.test.html?hole=1').then(function (el) {
			newHole(el).on('connect', function () {
				$(el).remove();
			});

			_createWin('local.test.html?hole=2').then(function (el) {
				newHole(el)
					.on('master', function () { log.push('master:slave'); })
					.on('foo', function () { fooLog.push(this.id); })
				;
			});

			_createWin('local.test.html?hole=3').then(function (el) {
				newHole(el)
					.on('master', function () { log.push('master:slave'); })
					.on('connect', function () { main.destroy(); })
					.on('foo', function () { fooLog.push(this.id); })
					.emit('foo', [1, '-', 1])
				;
			});

			_createWin('local.test.html?hole=4').then(function (el) {
				newHole(el)
					.on('master', function () { log.push('master:slave'); })
					.on('foo', function () { fooLog.push(this.id); })
				;
			});

			_createWin('local.test.html?hole=5').then(function (el) {
				newHole(el).on('master', function () { log.push('master:slave'); });
			});
		});


		setTimeout(function () {
			main.destroy();

			deepEqual(log, [
				'connect:' + main.id,
				'master:' + main.id,
				'master:slave'
			]);

			start();
		}, 1500);
	});


	// Проверка peers
	asyncTest('peers', function () {
		var max = 10; // кол-во iframe
		var tabs = [];

		function holes() {
			for (var i = 0; i < max; i++) {
				/* jshint loopfunc:true */
				tabs.push(_createWin('local.test.html?hole=' + i).then(function (el) {
					var hole = newHole(el, 'local.test.html?peers');
					hole.el = el;
					return hole;
				}));
			}

			return $.when.apply($, tabs);
		}

		holes().then(function (tab) {
			var count = 0;

			tab.on('peers', function (cnt) {
				ok(true, 'count: ' + cnt);
				count = cnt;
			});

			setTimeout(function () {
				equal(count, max, 'total: ' + max);

				holes().then(function () {
					setTimeout(function () {
						equal(count, max*2, 'total: ' + max*2);

						holes().then(function () {
							var tabs = [].slice.call(arguments);
							var removeCnt = 7;

							setTimeout(function () {
								equal(count, max*3, 'total: ' + max*3);

								tabs[10].on('peers', function (cnt) {
									ok(true, '10.count: ' + cnt);
									count = cnt;
								});

								tabs.splice(0, removeCnt).forEach(function (hole) {
									$(hole.el).remove();
								});

								setTimeout(function () {
									equal(count, max*3 - removeCnt, 'total: ' + max*3 - removeCnt);

									tabs.pop().on('peers', function (cnt) {
										ok(true, 'pop.count: ' + cnt);
										count = cnt;
									});

									tabs.forEach(function (hole) {
										$(hole.el).remove();
									});

									setTimeout(function () {
										equal(count, 1, 'end');
										start();
									}, 1000);
								}, 1000);
							}, 1000);
						});
					}, 1000);
				});
			}, 1000);
		});
	});


	// Проверка на мастер
	asyncTest('master', function () {
		var max = 10; // кол-во iframe
		var tabs = [];
		var log = [];
		var pid;


		for (var i = 0; i < max; i++) {
			tabs.push(_createWin('local.test.html?hole=' + i));
		}


		$.when.apply($, tabs).then(function () {
			[].forEach.call(arguments, function (el, i) {
				newHole(el).on('master', function () {
					ok(true, '#' + i);
					log.push(this.id);

					$(el).remove();

					clearTimeout(pid);
					pid = setTimeout(function () {
						equal(log.length, max);

						log.forEach(function (id, i) {
							ok(log.indexOf(id, i + 1) === -1, true);
						});
						start();
					}, 1100);
				});
			});
		});
	});


	// Проверяем события между воркерами (в рамках одного домена)
	asyncTest('events', function () {
		var max = 10; // кол-во iframe
		var tabs = [];
		var syncLogs = {};
		var asyncLogs = {};


		for (var i = 0; i < max; i++) {
			tabs.push(_createWin('local.test.html?hole=' + i));
		}


		$.when.apply($, tabs).then(function () {
			[].slice.call(arguments).forEach(function (el, i) {
				var hole = newHole(el)
					.on('sync', function (data) {
						syncLogs[i] = (syncLogs[i] || []);
						syncLogs[i].push(data);
					})
					.on('async', function (data) {
						asyncLogs[i] = (asyncLogs[i] || []);
						asyncLogs[i].push(data);
					})
				;

				hole.emit('sync', i);

				setTimeout(function () {
					hole.emit('async', i);
				}, 10);
			});

			setTimeout(function () {
				equal(syncLogs[0] && syncLogs[0].length, max, 'sync.length');
				equal(asyncLogs[0] && asyncLogs[0].length, max, 'async.length');

				for (var i = 0; i < max; i++) {

					deepEqual(syncLogs[i], syncLogs[0], 'hole.sync #' + i);
					deepEqual(asyncLogs[i], asyncLogs[0], 'hole.async #' + i);
				}

				start();
			}, 1500);
		}, function () {
			ok(false, 'fail');
			start();
		});
	});


	// Проверка вызова удаленных команд
	asyncTest('cmd', function () {
		var url = 'local.test.html',
			actual = {},
			expected = {},
			
			_finish = wormhole.debounce(function () {
				deepEqual(actual, expected);
				start();
			}, 600),

			_set = function (key, value) {
				ok(!(key in actual), key + ((key in actual) ? ' - already added' : ''));
				actual[key] = value;
				_finish();
			}
		;

		function newTabHole() {
			return _createWin(url).then(function (el) {
				_finish();
				return new newHole(el, url);
			});
		}

		$.Deferred().resolve(new wormhole.Hole(url, useStore)).then(function (foo) {
			expected['foo:' + foo.id] = 1;
			expected['foo.foo'] = 1;
			expected['foo.master'] = 1;
			expected['foo.sync'] = 'ok';
			expected['foo.async'] = 'aok';

			foo.on('master', function () {
				_set('foo:' + this.id, 1);
				_set('foo.master', 1);
			});

			// Определяем команду (синхронную)
			foo.foo = function (data) {
				_set('foo.foo', data);
				return data * 2;
			};

			foo.sync = function _(data, next) {
				ok(true, 'foo.async');
				next(null, data);
			};

			foo.async = function _(data, next) {
				ok(true, 'foo.async');
				setTimeout(function () {
					next(null, data);
				}, 10);
			};

			foo.fail = function () {
				ok(true, 'foo.fail');
				throw "BOOM!";
			};

			newTabHole().then(function (bar) {
				expected['bar.foo.result'] = 2;
				expected['bar.fail.result'] = 'wormhole.fail: BOOM!';
				expected['bar.unkown.result'] = 'wormhole.unkown: method not found';

				bar.on('master', function () {
					_set('bar:' + bar.id, 1);
				});

				// Вызываем команду
				bar.call('foo', 1, function (err, result) {
					_set('bar.foo.result', result);
				});

				bar.call('fail', function (err) {
					_set('bar.fail.result', err);
				});

				bar.call('sync', 'ok', function (err, result) {
					_set('foo.sync', result);
				});
				bar.call('async', 'aok', function (err, result) {
					_set('foo.async', result);
				});

				bar.call('unkown', function (err) {
					_set('bar.unkown.result', err);
				});

				// Next Level
				setTimeout(function () {
					expected['bar:' + bar.id] = 1;

					// Уничтожаем foo, bar должен стать мастером
					foo.destroy();


					// Hard level
					setTimeout(function () {
						newTabHole().then(function (baz) {
							expected['baz:' + baz.id] = true;
							expected['baz.async.result'] = ['y', 'x'];

							baz.on('master', function () {
								_set('baz:' + baz.id, true);
							});

							baz.async = function (data, next) {
								ok(true, 'baz.async');

								setTimeout(function () {
									ok(true, 'baz.async.next');
									next(null, data.reverse());
								}, 50);
							};

							// Уничтожаем bar, теперь baz один и мастер
							bar.destroy();

							baz.call('async', ['x', 'y'], function (err, result) {
								_set('baz.async.result', result);
							});

							baz.baz = function (data) {
								if (data) {
									_set('qux.call.baz.data', data);
								} else {
									_set('qux.call.baz', 1);
								}
								return 321;
							};

							// Bonus level
							setTimeout(function () {
								expected['qux.call.baz'] = 1;
								expected['qux.call.baz.data'] = 8;
								expected['qux.call.baz.fn'] = 321;

								var qux = new wormhole.Hole(url, useStore);

								qux.call('baz');
								qux.call('baz', 8, function (err, x) {
									_set('qux.call.baz.fn', x);
								});
								qux.call('baz-x', function () {});

								qux.qux = function () {};

								baz.call('qux');
							}, 500);
						});
					}, 500);
				}, 500);
			});
		});
	});


	// А теперь нужно прогнать тесты с использование `store`.
	!useStore && _tryAgainTest(true);
})(!wormhole.Worker.support);
