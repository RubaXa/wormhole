define([], function () {
	var now = Date.now || function () {
		return +(new Date);
	};

	// Export
	return now;
});
