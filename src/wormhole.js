define(["cors", "emitter", "store", "worker"], function (cors, emitter, store, Worker) {
	window.wormhole = {
		cors: cors,
		store: store,
		emitter: emitter,
		Worker: Worker
	};
});
