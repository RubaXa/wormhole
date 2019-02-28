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
		var holes = [];
		var done = assert.async();

		function createHoles(count, wait) {
			assert.ok(true, 'Holes: ' + count);
			var start =  tabs.length;

			for (var i = start; i < count; i++) {
				/* jshint loopfunc:true */
				tabs.push(_createWin('local.test.html?peers=' + i).then(function (wait, el) {
					var hole = newHole(el, 'local.test.html?peers');
					hole.el = el;
					holes.push(hole);
					if (wait) {
						return waitPeers(hole, count).then(function () {
							return hole;
						})
					}
					return hole;
				}.bind(null, wait && i === start)));
			}

			return $.when.apply($, tabs).then(function () {
				return [].slice.call(arguments);
			});
		}

		function waitPeers(hole, count) {
			var cnt = -1;
			var dfd = $.Deferred();
			var peers = [];
			var pid = setTimeout(function () {
				cnt = 'TIMEOUT';
				end();
				dfd.reject();
			}, 15000);

			function end() {
				clearTimeout(pid);
				hole.off('peers', handle);

				assert.equal(cnt, count, ' - Peers: ' + count);
				assert.equal(holes.length, count, ' - Holes: ' + count);

				var exists = peers.filter(function (id) {
					return holes.some(function (p) {
						return p.id == id;
					});
				});

				assert.equal(exists.length, holes.length, ' - Exists peers');
			}

			function handle(list) {
				cnt = list.length;
				peers = list;

				if (cnt === count) {
					end();
					dfd.resolve();
				}
			}

			hole.on('peers', handle);

			return dfd;
		}

		$.Deferred().resolve()
			.then(function () { return createHoles(max, true); })
			.then(function () { return createHoles(max * 2, true); })
			.then(function () { return createHoles(max * 5, true); })
			.then(function () {
				var toRemove = 17;
				var promise = waitPeers(holes[toRemove], holes.length - toRemove);

				holes.splice(0, toRemove).forEach(function (hole) {
					ie8 && hole.destroy();
					$(hole.el).remove();
				});

				return promise;
			})
			.then(function () { return createHoles(max * 10, true); })
			.always(function () {
				done();
			})
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
