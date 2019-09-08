'use strict'

const http = require('http'),
	fs = require('fs'),
	path = require('path'),
	redir = {},
	config = {
		port: 3500
	};

function log(data){
	var d = new Date,
		out = new String,
		h = d.getHours() < 10 ? "0" + d.getHours() : d.getHours(),
		m = d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes(),
		s = d.getSeconds() < 10 ? "0" + d.getSeconds() : d.getSeconds(),
		ms = (function () {
			let ms = d.getMilliseconds()
			return ms < 10 ? '00' + ms : (ms < 100 ? '0' + ms : ms)
		})()

	
	console.log(`${d.getDate()}/${d.getMonth()+1} ${h}:${m}:${s}:${ms} ${data}`)
}

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
		log(`! ${at} [${ip}] (${who})`)
	} else {
		res.setHeader('Location', where)
		res.writeHead(302)
		res.end(/*`Location:\t${where}\nAddr:\t\t${ip}\nToken:\t\t${who}`*/);
		log(`# ${at} 200 -> '${where}' [${ip}] (${who})`)
	}
});

fs.readdir(path.join(__dirname, 'configs'), (err, files) => {
	files.forEach(file => {
		log(`Loaded '${file.slice(0, -5)}' config`)
		redir[file.slice(0, -5)] = require(`./configs/${file}`)
	});

	server.listen(config.port);
	log(`Server listening on port ${config.port}\n`)

});