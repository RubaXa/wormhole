(function () {
	"use strict";

	xtpl.ctrl('main', function (ctx) {
		var hole = wormhole();

		ctx.colors = [
			'cadetblue',
			'skyblue',
			'seagreen',
			'tan'
		];

		ctx.holes = 0;
		ctx.bgcolor = 'cadetblue';

		ctx.chooseColor = function (color) {
			hole.emit('bgcolor', color);
		};


		hole.on('bgcolor', function (color) {
			ctx.$set('bgcolor', color);
			document.getElementsByTagName('html')[0].style.backgroundColor = color;
		});


		hole.on('peers', function (count) {
			if (hole.master) {
				hole.emit('bgcolor', ctx.bgcolor);
			}

			ctx.$set('holes', count);
		});
	});



	// Background
	document.addEventListener("DOMContentLoaded", function () {
		function setNoiseBackground(el, width, height, opacity) {
			var canvas = document.createElement("canvas");
			var context = canvas.getContext("2d");

			canvas.width = width;
			canvas.height = height;

			for (var i = 0; i < width; i++) {
				for (var j = 0; j < height; j++) {
					var val = Math.floor(Math.random() * 255);
					context.fillStyle = "rgba(" + val + "," + val + "," + val + "," + opacity + ")";
					context.fillRect(i, j, 1, 1);
				}
			}

			el.style.background = "url(" + canvas.toDataURL("image/png") + ")";
		}

		setNoiseBackground(document.getElementsByTagName('body')[0], 50, 50, 0.02);
	}, false);
})();
