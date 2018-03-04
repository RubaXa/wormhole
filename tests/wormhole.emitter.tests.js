(function (Emitter) {
	QUnit.module('wormhole.Emitter');


	// Излучатель: on/off/emit
	QUnit.test('core', function (assert) {
		var log = [];
		var emitter = new Emitter;

		var onFoo = function (data) {
			log.push('foo-' + data);
		};

		var onBar = function (data) {
			log.push('bar-' + data);
		};

		var onBaz = function () {
			log.push('baz-' + [].slice.call(arguments, 0).join('.'));
		};

		emitter.on("foo", onFoo);
		emitter.on("bar", onBar);
		emitter.on("baz", onBaz);

		emitter.emit("foo", 1);
		emitter.emit("bar", 1);

		emitter.off("foo", onBar);
		emitter.emit("foo", 2);
		emitter.emit("bar", 2);

		emitter.off("foo", onFoo);
		emitter.emit("foo", 3);
		emitter.emit("bar", 3);

		emitter.emit('baz');
		emitter.emit('baz', [1, 2]);
		emitter.emit('baz', [1, 2, 3]);
		emitter.emit('baz', [1, 2, 3, 4, 5]);

		assert.equal(log + '', 'foo-1,bar-1,foo-2,bar-2,bar-3,baz-,baz-1.2,baz-1.2.3,baz-1.2.3.4.5');
	});


	QUnit.test('__emitter__', function (assert) {
		var emitter = new Emitter;
		var foo = function () {/*foo*/};
		var bar = function () {/*bar*/};

		emitter.on('change', foo);
		emitter.on('change', foo);
		emitter.on('change', bar);
		emitter.on('change', bar);

		assert.equal(Emitter.getListeners(emitter, 'change').length, 4);

		emitter.off('change', bar);
		assert.equal(Emitter.getListeners(emitter, 'change').length, 3);

		emitter.off('change', bar);
		assert.equal(Emitter.getListeners(emitter, 'change').length, 2);

		emitter.off('change', foo);
		assert.equal(Emitter.getListeners(emitter, 'change').length, 1);

		emitter.off('change', foo);
		assert.equal(Emitter.getListeners(emitter, 'change').length, 0);
	});


	QUnit.test('one', function (assert) {
		var log = [];
		var emitter = new Emitter;

		emitter.one('foo', function (x) {
			log.push(x);
		});

		emitter.emit('foo', 'ok');
		emitter.emit('foo', 'fail');

		assert.equal(log + '', 'ok');
	});
})(wormhole.Emitter);
