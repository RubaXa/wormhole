define(["cors", "emitter", "store", "worker"], function (cors, Emitter, store, Worker) {


	// Export
	window.wormhole = {
		cors: cors,
		store: store,
		Emitter: Emitter,
		Worker: Worker
	};
});
