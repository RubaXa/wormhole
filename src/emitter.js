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


	/**
	 * @class Emitter
	 * @desc  Микро-излучатель
	 */
	function Emitter() {
	}


	Emitter.fn = Emitter.prototype = /** @lends Emitter.prototype */ {
		/**
		 * Подписаться на событие
		 * @param   {String}   name
		 * @param   {Function} fn
		 * @returns {Emitter}
		 */
		on: function (name, fn) {
			var list = getListeners(this, name);
			list.push(fn);
			return this;
		},


		/**
		 * Отписаться от событие
		 * @param   {String}   name
		 * @param   {Function} fn
		 * @returns {Emitter}
		 */
		off: function (name, fn) {
			if (name === void 0) {
				delete this[__emitter__];
			}
			else {
				var list = getListeners(this, name),
					i = list.length;

				while (i--) {
					// Ищем слушателя и удаляем (indexOf - IE > 8)
					if (list[i] === fn) {
						list.splice(i, 1);
						break;
					}
				}
			}

			return this;
		},


		/**
		 * Подписаться на событие и отписаться сразу после его получения
		 * @param   {String}   name
		 * @param   {Function} fn
		 * @returns {Emitter}
		 */
		one: function (name, fn) {
			var proxy = function () {
				this.off(name, proxy);
				return fn.apply(this, arguments);
			};

			return this.on(name, proxy);
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

			args = (arguments.length === 1) ? [] : [].concat(args);
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


	/**
	 * Подмешать методы
	 * @param   {*}  target
	 * @returns {*}
	 * @method
	 */
	Emitter.apply = function (target) {
		target.on = Emitter.fn.on;
		target.off = Emitter.fn.off;
		target.one = Emitter.fn.one;
		target.emit = Emitter.fn.emit;

		return target;
	};


	Emitter.getListeners = getListeners;


	// Export
	return Emitter;
});
