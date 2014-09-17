define([], function () {
	var floor = Math.floor,
		random = Math.random
	;


	function s4() {
		return floor(random() * 0x10000 /* 65536 */).toString(16);
	}


	/**
	 * UUID — http://ru.wikipedia.org/wiki/UUID
	 * @returns {String}
	 */
	function uuid() {
		return (s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4());
	}


	/**
	 * Генерация hash на основе строки
	 * @param   {String} str
	 * @returns {String}
	 */
	uuid.hash = function (str) {
		var hash = 0,
			i = 0,
			length = str.length
		;

		/* istanbul ignore else */
		if (length > 0) {
			for (; i < length; i++) {
				hash = ((hash << 5) - hash) + str.charCodeAt(i);
				hash |= 0; // Convert to 32bit integer
			}
		}

		return hash.toString(36);
	};


	// Export
	return uuid;
});
