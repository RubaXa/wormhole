(function umd(factory) {
	if (typeof define === 'function' && define.amd) {
		define(['./wormhole'], factory);
	} else if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
		module.exports = factory(require('./wormhole'));
	} else {
		window.wormhole.WS = factory(window.wormhole);
	}
})(function factory(wormhole) {
	'use strict';

	var ns = '__wormhole.js/ws__:';

	var META_CMD = ns + 'meta:cmd';
	var SEND_CMD = ns + 'send:cmd';

	var META_EVENT = ns + 'meta';
	var MESSAGE_EVENT = ns + 'msg';

	/**
	 * Wormhole WebSocket (proxy object)
	 * @param {string} url
	 * @param {[]string} [protocols]
	 * @param {womrhole.Hole} [hole]
	 */
	function WS(url, protocols, hole) {
		var _this = this;

		_this.master = false;
		_this.url = url;
		_this.protocols = protocols;
		_this.hole = hole = (hole || wormhole());

		// Meta info about connection state
		_this.meta = {
			error: null,
			closed: null,
		};

		// Subscribe on change meta info
		hole.on(META_EVENT, function (meta) {
			_this.handleMeta(meta);
		});

		// Subscribe on WebSocket.onmessage
		hole.on(MESSAGE_EVENT, function (evt) {
			_this.onmessage(evt);
		});

		hole.on('master', function () {
			_this.connect();
		});

		// Register command on master for getting meta info for slaves
		hole[META_CMD] = function () {
			return _this.meta;
		};

		// Register command for send data to WS
		hole[SEND_CMD] = function (data) {
			_this.socket.send(data);
		};

		if (hole.master) {
			_this.connect();
		} else {
			hole.call(META_CMD, null, function (err, meta) {
				err && console.warn('[meta] wormhole.js/ws:', err);
				meta && _this.handleMeta(meta)
			});
		}
	}

	WS.prototype = {
		constructor: WS,

		/** @private */
		handleMeta: function (meta) {
			var m = this.meta;

			this.meta = meta;

			if (meta.error) {
				!m.error && this.onerror(meta.error);
			} else if (meta.closed) {
				!m.closed && this.onclose(meta.closed);
			} else if (meta.closed === false) {
				(m.closed !== false) && this.onopen({type: 'open'});
			}
		},

		/** @private */
		setMeta: function (meta) {
			this.hole.emit(META_EVENT, meta);
		},

		/** @private */
		connect: function () {
			var _this = this;

			var socket = new WebSocket(_this.url, _this.protocols);

			_this.socket = socket;

			socket.onopen = function (evt) {
				_this.setMeta({
					closed: false,
				});
			};

			socket.onclose = function (evt) {
				this.setMeta({
					closed: {
						type: evt.type,
						wasClean: evt.wasClean,
						code: evt.code,
						reason: evt.reason,
					},
				});
			};

			socket.onerror = function (evt) {
				this.setMeta({
					error: {
						type: evt.type,
						message: evt.message,
					},
				});
			};

			socket.onmessage = function (evt) {
				_this.hole.emit(MESSAGE_EVENT, {
					type: evt.type,
					data: evt.data,
				});
			};

			_this.master = true;
			_this.onmaster({type: 'master'});
		},

		onmaster: function (evt) {},
		onopen: function (evt) {},
		onmessage: function (evt) {},
		onclose: function (evt) {},
		onerror: function (evt) {},

		/**
		 * Send data to WebSocket
		 * @param {string} data
		 */
		send: function (data) {
			this.hole.call(SEND_CMD, data);
		},
	};

	// Export
	WS['default'] = WS;
	return WS;
});