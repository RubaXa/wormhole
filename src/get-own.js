define([], function () {
	function getOwn(obj, prop) {
		return !(prop in getOwn) && obj && obj.hasOwnProperty(prop) ? obj[prop] : null;
	}

	// Export
	return getOwn;
});
