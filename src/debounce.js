define([], function () {
	function debounce(func, delay, immediate) {
		var timeout;

		return function() {
			var context = this,
				args = arguments;

			clearTimeout(timeout);

			timeout = setTimeout(function() {
				timeout = null;

				/* istanbul ignore else */
				if (!immediate) {
					func.apply(context, args);
				}
			}, delay);

			/* istanbul ignore next */
			if (immediate && !timeout) {
				func.apply(context, args);
			}
		};
	}


	// Export
	return debounce;
});
