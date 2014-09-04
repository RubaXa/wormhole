define([], function () {
	var __emitter__ = '__emitter__';

	function getListeners(obj, name) {
		if (obj[__emitter__] === void 0) {
			obj[__emitter__] = {};
		}

		obj = obj[__emitter__];

		if (obj[name] === void 0) {
			obj[name] = [];
		}

		return obj[name];
	}


	function emitter() {
	}


	emitter.fn = emitter.prototype = /** @lends emitter.prototype */ {
		/**
		 * Подписаться на событие
		 * @param   {String}   name
		 * @param   {Function} fn
		 * @returns {emitter}
		 */
		on: function (name, fn) {
			getListeners(this, name).push(fn);
			return this;
		},


		/**
		 * Отписаться от событие
		 * @param   {String}   name
		 * @param   {Function} fn
		 * @returns {emitter}
		 */
		off: function (name, fn) {
			var listeners = getListeners(this, name),
				i = listeners.length;

			while (i--) {
				// Ищем слушателя и удаляем (indexOf - IE > 8)
				if (listeners[i] === fn) {
					listeners.splice(i, 1);
					break;
				}
			}

			return this;
		},


		/**
		 * Распространить данные
		 * @param   {String}   name
		 * @param   {*}        [args]
		 */
		emit: function (name, args) {
			var listeners = getListeners(this, name),
				i = listeners.length,
				nargs
			;

			args = args === void 0 ? [] : [].concat(args);
			nargs = args.length;

			while (i--) {
				if (nargs === 0) {
					listeners[i].call(this);
				}
				else if (nargs === 1){
					listeners[i].call(this, args[0]);
				}
				else if (nargs === 2){
					listeners[i].call(this, args[0], args[1]);
				}
				else {
					listeners[i].apply(this, args);
				}
			}
		}
	};


	emitter.apply = function (target) {
		target.on = emitter.fn.on;
		target.off = emitter.fn.off;
		target.emit = emitter.fn.emit;

		return target;
	};


	// Export
	return emitter;
});
