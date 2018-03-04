(function _tryAgainTest(useStore) {
	QUnit.module('wormhole.Hole.' + (useStore ? 'store' : 'worker'));

	var ie8 = /MSIE 8/.test(navigator.userAgent);


	function newHole(el, url) {
		var Hole = wormhole.Hole;

		if (el) {
			Hole = (el.contentWindow && el.contentWindow.wormhole.Hole) || el.wormhole.Hole;
		}

		return new Hole(url || 'local.test.html', useStore);
	}


	function createHole(url) {
		return _createWin(url).then(function (el) {
			return newHole(el, url);
		});
	}


	QUnit.test('core', function (assert) {
		var log = [];
		var fooLog = [];
		var url = 'local.test.html?core';
		var main = newHole(null, url);
		var done = assert.async()


		main
			.emit('xxx')
			.on('ready', function (hole) {
				if (useStore) {
					assert.ok(hole.emit === hole._storeEmit, 'sotreEmit');
				} else {
					assert.ok(hole.worker instanceof window.SharedWorker, 'instanceof');
					assert.ok(hole.emit === hole._workerEmit, 'workerEmit');
				}

				log.push('ready:' + hole.id);
			})
			.on('master', function (hole) {
				log.push('master:' + hole.id);


				_createWin('local.test.html?hole=1').then(function (el) {
					newHole(el, url).on('ready', function (hole) {
						ie8 && hole.destroy();
						$(el).remove();
					});

					_createWin('local.test.html?hole=2').then(function (el) {
						newHole(el, url)
							.on('master', function () { log.push('master:slave'); })
							.on('foo', function () { fooLog.push(this.id); })
						;
					});

					_createWin('local.test.html?hole=3').then(function (el) {
						newHole(el, url)
							.on('master', function () { log.push('master:slave'); })
							.on('ready', function () { main.destroy(); })
							.on('foo', function () { fooLog.push(this.id); })
							.emit('foo', [1, '-', 1])
						;
					});

					_createWin('local.test.html?hole=4').then(function (el) {
						newHole(el, url)
							.on('master', function () { log.push('master:slave'); })
							.on('foo', function () { fooLog.push(this.id); })
						;
					});

					_createWin('local.test.html?hole=5').then(function (el) {
						newHole(el, url).on('master', function () { log.push('master:slave'); });
					});
				});
		});



		setTimeout(function () {
			main.destroy();

			assert.deepEqual(log, [
				'ready:' + main.id,
				'master:' + main.id,
				'master:slave'
			]);

			done();
		}, 1500);
	});


	// Проверка peers
	QUnit.test('peers', function (assert) {
		var max = 10; // кол-во iframe
		var tabs = [];
		var done = assert.async();

		function holes() {
			for (var i = 0; i < max; i++) {
				/* jshint loopfunc:true */
				tabs.push(_createWin('local.test.html?peers=' + i).then(function (el) {
					var hole = newHole(el, 'local.test.html?peers');
					hole.el = el;
					return hole;
				}));
			}

			return $.when.apply($, tabs);
		}

		// Первая пачка по 10 iframe
		holes().then(function (tab) {
			var count = 0;

			arguments[Math.floor(max/2)].on('peers', function (peers) {
				count = peers.length;
				assert.ok(true, '#1.count: ' + count);
			});

			setTimeout(function () {
				assert.equal(count, max, '#2.total: ' + max);
				assert.equal(tab.length, max, '#2.length: ' + max);

				// Вторая пачка по 10 iframe
				holes().then(function () {
					setTimeout(function () {
						assert.equal(count, max*2, '#3.total: ' + max*2);
						assert.equal(tab.length, max*2, '#3.length: ' + max*2);

						// Третья пачка по 10 iframe
						holes().then(function () {
							var tabs = [].slice.call(arguments);
							var removeCnt = 7;

							setTimeout(function () {
								assert.equal(count, max*3, '#4.total: ' + max*3);
								assert.equal(tab.length, max*3, '#4.length: ' + max*3);

								tab = tabs[10].on('peers', function (peers) {
									count = peers.length;
									assert.ok(true, '#5.10.count: ' + count);
								});

								$.each(tabs.splice(0, removeCnt), function (i, hole) {
									ie8 && hole.destroy();
									$(hole.el).remove();
								});

								setTimeout(function () {
									assert.equal(count, max*3 - removeCnt, '#6.total: ' + (max*3 - removeCnt));
									assert.equal(tab.length, max*3 - removeCnt, '#6.length: ' + (max*3 - removeCnt));

									tab = tabs.pop().on('peers', function (peers) {
										count = peers.length;
										assert.ok(true, '#7.pop.count: ' + count);
									});

									$.each(tabs, function (i, hole) {
										ie8 && hole.destroy();
										$(hole.el).remove();
									});

									setTimeout(function () {
										assert.equal(count, 1, '#8.total: 1');
										assert.equal(tab.length, 1, '#8.length: 1');
										done();
									}, 1000);
								}, 2000);
							}, 2000);
						});
					}, 2000);
				});
			}, 2000);
		});
	});


	// Проверка событий
	QUnit.test('peers:events', function (assert) {
		var actual = {};
		var expected = {};
		var done = assert.async();

		createHole('local.test.html?peers:event').then(function (hole) {
			expected['add:' + hole.id] = 1;

			hole.on('peers:add', function (id) {
				actual['add:' + id] = 1;
			});

			setTimeout(function () {
				createHole('local.test.html?peers:event').then(function (someHole) {
					expected['add:' + someHole.id] = 1;
					expected['some-add:' + hole.id] = 1;
					expected['some-add:' + someHole.id] = 1;
					expected['some-remove:' + hole.id] = 1;

					someHole.on('peers:add', function (id) {
						actual['some-add:' + id] = 1;
					});

					someHole.on('peers:remove', function (id) {
						actual['some-remove:' + id] = 1;
					});

					setTimeout(function () {
						assert.equal(someHole.length, 2, 'length');
						hole.destroy();

						setTimeout(function () {
							assert.deepEqual(actual, expected);
							done();
						}, 100);
					}, 100);
				});
			}, 100);
		});
	});


	// Проверка на мастер
	QUnit.test('master', function (assert) {
		var max = 10; // кол-во iframe
		var tabs = [];
		var log = [];
		var pid;
		var done = assert.async();


		for (var i = 0; i < max; i++) {
			tabs.push(_createWin('local.test.html?master=' + i));
		}


		$.when.apply($, tabs).then(function () {
			$.each(arguments, function (i, el) {
				newHole(el, 'local.test.html?master')
					.on('ready', function () {
//						console.log('hole.ready: ' + this.id);
					})
					.on('master', function (hole) {
						assert.ok(true, '#' + i + ':' + hole.id);
						log.push(hole.id);

						ie8 && hole.destroy();
						$(el).remove();

						clearTimeout(pid);
						pid = setTimeout(function () {
							assert.equal(log.length, max); // кол-во мастеров

							$.each(log, function (idx, id) {
								for (var i = idx; i < log.length; i++) {
									if (log[i] === id) {
										assert.ok(true, '#' + idx);
										return;
									}
								}

								assert.ok(false, '#' + idx);
							});

							done();
						}, 1500);
					});
			});
		});
	});


	// Проверяем события между воркерами (в рамках одного домена)
	QUnit.test('events', function () {
		var max = 10; // кол-во iframe
		var tabs = [];
		var syncLogs = {};
		var asyncLogs = {};
		var done = assert.async();

		for (var i = 0; i < max; i++) {
			tabs.push(_createWin('local.test.html?hole=' + i));
		}

		$.when.apply($, tabs).then(function () {
			$.each(arguments, function (i, el) {
				var hole = newHole(el, 'local.test.html?events')
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
				assert.equal(syncLogs[0] && syncLogs[0].length, max, 'sync.length');
				assert.equal(asyncLogs[0] && asyncLogs[0].length, max, 'async.length');

				for (var i = 0; i < max; i++) {
					assert.deepEqual(syncLogs[i], syncLogs[0], 'hole.sync #' + i);
					assert.deepEqual(asyncLogs[i], asyncLogs[0], 'hole.async #' + i);
				}

				done();
			}, 1500);
		}, function () {
			assert.ok(false, 'fail');
			done();
		});
	});


	// Проверка вызова удаленных команд
	QUnit.test('cmd', function () {
		var url = 'local.test.html?cmd';
		var actual = {};
		var expected = {};
		var done = assert.async()
		var _finish = wormhole.debounce(function () {
			assert.deepEqual(actual, expected);
			done();
		}, 600),

			_set = function (key, value) {
				assert.ok(!(key in actual), key + ((key in actual) ? ' - already added' : ''));
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
				assert.ok(true, 'foo.async');
				next(null, data);
			};

			foo.async = function _(data, next) {
				assert.ok(true, 'foo.async');
				setTimeout(function () {
					next(null, data);
				}, 10);
			};

			foo.fail = function () {
				assert.ok(true, 'foo.fail');
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
								assert.ok(true, 'baz.async');

								setTimeout(function () {
									assert.ok(true, 'baz.async.next');
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
