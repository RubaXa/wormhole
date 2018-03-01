(function () {
	"use strict";

	console.info('wormhole.js')
	console.log(' - SharedWorker:', wormhole.Worker.support);
	console.log(' - Use WebSocket:', !!wormhole.WS);

	var hole = wormhole();
	var socket = wormhole.WS ? new wormhole.WS('ws://echo.websocket.org') : null;

	if (socket) {
		socket.onopen = socket.onerror = socket.onclose = function (evt) {
			console.warn('[wormhole.WS]', evt.type + ':', evt);
		};
	}

	xtpl.ctrl('main', function (ctx) {
		ctx.holes = 0;
		ctx.images = [1, 2, 3, 4, 5];
		ctx.imageNum = ctx.images[Math.random() * ctx.images.length | 0];
		ctx.images.forEach(function (num) {
			(new Image).src = './st/image-' + num + '.png';
		});

		if (socket) {
			socket.onmaster = onmaster;
			socket.onmessage = function (evt) {
				var data = JSON.parse(evt.data);
				if (data.type === 'choose') {
					onchoose(data.num);
				}
			};

			ctx.choose = function (num) {
				socket.send(JSON.stringify({
					type: 'choose',
					num: num,
				}));
			};

			hole.on('peers', function (peers) {
				socket.master && ctx.choose(ctx.imageNum);
				ctx.$set('holes', peers.length);
			});
		} else {
			hole.on('master', onmaster);
			hole.on('choose', onchoose);
			hole.on('peers', function (peers) {
				hole.master && ctx.choose(ctx.imageNum);
				ctx.$set('holes', peers.length);
			});

			ctx.choose = function (num) {
				hole.emit('choose', num);
			};
		}

		function onmaster() {
			window.console && console.log('I master');
			document.title = '⬤ ' + document.title;
		}

		function onchoose(num) {
			ctx.$set('imageNum', num);
			console.log('[' + new Date + '] image:', num);
		}
	});
})();
