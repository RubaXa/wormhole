define(["cors", "emitter", "store"], function (cors, emitter, store) {
	window.wormhole = {
		cors: cors,
		store: store,
		emitter: emitter
	};
});
