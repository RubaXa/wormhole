define([], function () {
	var now = Date.now || /* istanbul ignore next */ function () {
		return +(new Date);
	};

	// Export
	return now;
});
