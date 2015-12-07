define(["./now", "./uuid", "./debounce", "./cors", "./emitter", "./store", "./worker", "./hole"], function (now, uuid, debounce, cors, Emitter, store, Worker, Hole) {
	var singletonHole = function () {
		/* istanbul ignore else */
		if (!singletonHole.instance) {
			singletonHole.instance = new Hole();
		}

		return singletonHole.instance;
	};


	Worker.support &= (window.wormhole && wormhole.workers);


	// Export
	singletonHole.version = '0.7.2';
	singletonHole.now = now;
	singletonHole.uuid = uuid;
	singletonHole.debounce = debounce;
	singletonHole.cors = cors;
	singletonHole.store = store;
	singletonHole.Emitter = Emitter;
	singletonHole.Worker = Worker;

	singletonHole.Hole = Hole;
	singletonHole.Universal = Hole;


	/* istanbul ignore next */
	if (typeof define === 'function' && define.amd) {
		define(function () { return singletonHole; });
	}
	else if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
		module.exports = singletonHole;
	}
	else {
		window.wormhole = singletonHole;
	}
});
