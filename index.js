'use strict'

const http = require('http'),
	fs = require('fs'),
	path = require('path'),
	Tree = {},
	Config = {
		port: 3500,
		token: 10,
		default: 'https://www.maathias.pl/'
	};

var AuthTable = {};

function log(data) {
	var d = new Date,
		out = new String,
		h = d.getHours() < 10 ? "0" + d.getHours() : d.getHours(),
		m = d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes(),
		s = d.getSeconds() < 10 ? "0" + d.getSeconds() : d.getSeconds(),
		ms = (function () {
			let ms = d.getMilliseconds()
			return ms < 10 ? '00' + ms : (ms < 100 ? '0' + ms : ms)
		})()


	console.log(`${d.getDate()}/${d.getMonth() + 1} ${h}:${m}:${s}:${ms} ${data}`)
}

function parseCredentials(req) {
	const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
	const [login, pass] = new Buffer.from(b64auth, 'base64').toString().split(':')
	return {
		login: login === '' ? undefined : login,
		pass: pass === '' ? undefined : pass
	}
}

function requestAuth(res, realm, body) {
	res.setHeader('WWW-Authenticate', 'Basic realm="' + realm + '"') // change this
	res.writeHead(401)
	res.end(body) // custom message 
}

function rejectAuth(res, body) {
	res.writeHead(403)
	res.end(body)
}

var server = http.createServer(function (req, res) {

	function status(code) {
		log(`# ${at.path != '' ? at.path : "/"} | ${code} | ${ip} | ${who} | ${cred.login || ""}:${cred.pass || ""} | ${result ? "passed" : "failed"}`)
	}

	var cred = parseCredentials(req),

		rules = AuthTable[cred.login + ':' + cred.pass] || AuthTable['*'],

		at = (function () {
			let reg = /\/([^\?\n]*)\??(.*=.*)?/.exec(req.url)
			return {
				full: req.url,
				path: reg[1].endsWith('\/') ? reg[1].slice(0, -1) : reg[1],
				query: reg[2]
			}
		})(),

		ip = req.headers['x-real-ip'] ? req.headers['x-real-ip'] : req.connection.remoteAddress,

		who = (function () {
			var list = {},
				rc = req.headers.cookie;

			rc && rc.split(';').forEach(function (cookie) {
				var parts = cookie.split('=');
				list[parts.shift().trim()] = decodeURI(parts.join('='));
			});
			if (list.token === undefined) {
				var token = "";
				var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

				for (var i = 0; i < Config.token; i++)
					token += chars.charAt(Math.floor(Math.random() * chars.length));
				res.setHeader('Set-Cookie', `token=${token}; Path=/; Expires=Tue, 1 Jan 2040 00:00:00 GMT;`)
			} else token = list.token
			return token;
		})(),

		where = (function () {
			let dir = at.path.split('\/')

			if (dir[0] == '') return {
				content: Config.default,
				location: true,
				author: "root",
				date: "today",
				allowed: ["*"],
				disallowed: []
			}

			if (dir.length == 1) {
				if ('root' in Tree) {
					if (dir[0] in Tree.root) return Tree.root[dir[0]]
					else return null
				} else return null
			}

			var current = Tree
			for (let sub in dir) {
				if (dir[sub] in current) current = current[dir[sub]]
				if ('content' in current) {
					if (sub < dir.length - 1) return null
				}

				// // if (sub == '') continue
				// // if (typeof current == 'string') return null
				// if('content' in current) break;

				// if (sub in current) current = current[sub]
				// else return null
			}
			return current

		})(),

		result = (function () {
			if (where === null) return true
			let allowed = where.allowed.indexOf(cred.login + ":" + cred.pass) == -1 ? false : true,
				disallowed = where.disallowed.indexOf(cred.login + ":" + cred.pass) == -1 ? false : true

			if (!allowed) allowed = where.allowed.indexOf(cred.login + ":*") == -1 ? false : true
			if (!disallowed) disallowed = where.disallowed.indexOf(cred.login + ":*") == -1 ? false : true

			if (!allowed) allowed = where.allowed.indexOf("*") == -1 ? false : true
			if (!disallowed) disallowed = where.disallowed.indexOf("*") == -1 ? false : true

			return allowed && !disallowed
		})()

	if (!result) {
		if (!cred.login && !cred.pass) {
			status(401)
			requestAuth(res, "This link is protected", "Login and/or password required")
			return
		} else {
			status(401)
			requestAuth(res, "Wrong login/password", "Incorrect credentials")
			return
		}
	}

	if (where === null) {
		status(404)
		res.writeHead(404);
		res.end();
	} else {
		status(302)
		res.setHeader('Location', where.content)
		res.setHeader('X-Link-Author', where.author)
		res.setHeader('X-Link-Created', where.date)
		res.writeHead(302)
		res.end()
	}

});

log(`___Starting redirect server___`)
fs.readdir(path.join(__dirname, 'configs'), (err, files) => {
	if(err){
		log(`Folder 'configs' is unavailable. Exiting`)
		process.exit()
	}

	log(`Loading configuration files [${files.length}]`)

	files.forEach(file => {
		log(`Loaded '${file.slice(0, -5)}' config`)
		if (file === 'auth.json') {
			AuthTable = require(`./configs/${file}`)
			for (let user in AuthTable) {
				for (let table in AuthTable[user]) {
					for (let rule in AuthTable[user][table]) {
						AuthTable[user][table][rule] = new RegExp(AuthTable[user][table][rule])
					}
				}
			}
		}
		Tree[file.slice(0, -5)] = require(`./configs/${file}`)
	});

	server.listen(Config.port);
	log(`Server listening on port ${Config.port}`)

});