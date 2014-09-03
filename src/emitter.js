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
		 * @param   {*}        [data]
		 */
		emit: function (name, data) {
			var listeners = getListeners(this, name),
				i = listeners.length;

			while (i--) {
				listeners[i].call(this, data);
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
