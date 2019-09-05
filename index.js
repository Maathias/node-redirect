'use strict'

const http = require('http'),
	fs = require('fs'),
	path = require('path'),
	redir = {},
	config = {
		port: 3500
	};

var server = http.createServer(function (req, res) {
	var at = req.url.substring(1),
		ip = req.headers['x-real-ip'] ? req.headers['x-real-ip'] : req.connection.remoteAddress,

		who = (function (req) {
			var list = {},
				rc = req.headers.cookie;

			rc && rc.split(';').forEach(function (cookie) {
				var parts = cookie.split('=');
				list[parts.shift().trim()] = decodeURI(parts.join('='));
			});

			return list.token;
		})(req),

		where = (function (where) {
			if (where[0] == '') {
				return 'https://www.maathias.pl/'
			} else if (where.length == 1) {
				if ('root' in redir) {
					if (where[0] in redir.root) return redir.root[where[0]]
					else return false
				} else return false
			} else {
				var current = redir
				for (let sub of where) {
					if (sub == '') continue
					if (typeof current == 'string') return false
					if (sub in current) current = current[sub]
					else return false
				}
				return current
			}
		})(at.split('/'))

	if(who === undefined){
		who = (function () {
			var out = "";
			var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

			for (var i = 0; i < 25; i++)
				out += chars.charAt(Math.floor(Math.random() * chars.length));

			return out;
		})()
		res.setHeader('Set-Cookie', `token=${who}`)
	}

	if (where === false) {
		res.writeHead(404);
		res.end();
		console.log(`! ${at} [${ip}] (${who})`)
	} else {
		res.setHeader('Location', where)
		res.writeHead(302)
		res.end(`Location:\t${where}\nAddr:\t\t${ip}\nToken:\t\t${who}`);
		console.log(`# ${at} 200 -> '${where}' [${ip}] (${who})`)
	}
});

fs.readdir(path.join(__dirname, 'configs'), (err, files) => {
	files.forEach(file => {
		console.log(`Loaded '${file.slice(0, -5)}' config`)
		redir[file.slice(0, -5)] = require(`./configs/${file}`)
	});

	server.listen(config.port);
	console.log(`Server listening on port ${config.port}\n`)

});