/* eslint strict: 0 */
'use strict';

const dereferrer = require('../index.js');

const http = require('http');
const test = require('tape-catch');

const HTTP_OK = 200;

const mockup = callback => {
	var server = http.createServer(function (req, res) {
		res.setHeader('Content-Type', 'text/html');
		res.setHeader('Content-Length', server.testBuff.length);
		res.writeHead(HTTP_OK, 'OK');
		res.end(server.testBuff);
	});

	var address = null;

	server.listen(0, 'localhost', () => {
		if (address === null) {
			address = server.address();
			var href = 'http://' + address.address + ':' + address.port;
			callback(null, href);
		}
	});

	server.testTitle = 'Test title';
	server.testBody = 'TEST BODY';
	server.testHTML = '<html lang="pl"><head><title>' + server.testTitle + '</title></head><body>' + server.testBody + '</body></html>';
	server.testBuff = Buffer.from(server.testHTML);

	return server;
};

function testGetReferrerHTMLWithMissingReferrer (t) {
	const s = mockup(err => {
		t.ifError(err, '... while mockup does not error');

		const req = {
			headers: {}
		};
		dereferrer.getReferrerHTML(req, (err, html) => {
			t.ok(err, '... that errors on missing referrer URL');
			t.strictEqual(err.message, dereferrer.ERROR_REFERRER_MISSING, '... with predefined error message');
			t.strictEqual(html, undefined, '... that html is undefined');
			s.close(t.end.bind(t));
		});
	});
}

function testGetReferrerHTMLWithRefererHeader (t) {
	const s = mockup((err, address) => {
		t.ifError(err, '... while mockup does not error');

		const testCookie = 'test=12345';
		const req = {
			headers: {
				referer: address,
				cookie : testCookie
			}
		};

		s.once('request', function (req) {
			t.strictEqual(req.headers.cookie, testCookie, '... that should pass cookies');
		});

		dereferrer.getReferrerHTML(req, (err, html) => {
			t.ifError(err, '... that does not error');
			t.ok(html, '... that there is HTML returned');
			// t.ok(html.hasOwnProperty('html'), '... that calls back with cheerio object')
			// t.strictEqual(html.html(), s.testHTML, '... which was built from correct HTML');
			s.close(t.end.bind(t));
		});
	});
}

function testGetReferrerHTMLWithRefParam (t) {
	const s = mockup((err, address) => {
		t.ifError(err, '... while mockup does not error');

		const req = {
			url    : address + '?ref=' + encodeURIComponent(address),
			headers: {}
		};

		dereferrer.getReferrerHTML(req, (err, html) => {
			t.ifError(err, '... that does not error');
			t.ok(html, '... that there is HTML returned');
			// t.ok(html.hasOwnProperty('html'), '... that calls back with cheerio object');
			// t.strictEqual(html.html(), s.testHTML, '... which was built from correct HTML');
			s.close(t.end.bind(t));
		});
	});
}

test('It should provide default `getReferrerURL`...', t => {
	t.strictEqual(typeof dereferrer.getReferrerURL, 'function', '... that should be a function');

	const testURL = 'http://www.example.com/';
	let req = {
		headers: {
			referer: testURL
		}
	};

	t.strictEqual(dereferrer.getReferrerURL(req), testURL, '... that should return `referer` from request headers');

	req = {url: '/?ref=' + testURL};
	t.strictEqual(dereferrer.getReferrerURL(req), testURL, '... that should return `referer` from `ref` param, when `headers.referer` is missing');

	t.end();
});

test('It should provide default `getReferrerHTML` function...', t => {
	t.strictEqual(typeof dereferrer.getReferrerHTML, 'function', '... that should be a function');

	t.test('... that errors when referrer URL is missing', testGetReferrerHTMLWithMissingReferrer);
	t.test('... that works on request with `referer` header', testGetReferrerHTMLWithRefererHeader);
	t.test('... that works on request with `ref` param', testGetReferrerHTMLWithRefParam);
	t.end();
});

function testCreateWithCustomGetReferrerURL (t) {
	const s = mockup((err, address) => {
		t.ifError(err, '... while mockup does not error');

		let called = false;

		const f = dereferrer.createExpress({
			getReferrerURL: req => {
				called = true;
				return dereferrer.getReferrerURL(req);
			}
		});

		const req = {
			headers: {
				referer: address
			}
		};

		f(req, {}, err => {
			t.ifError(err, '... that does not error');
			t.ok(called, '... that allows overriding `getReferrerURL` function');
			s.close(t.end.bind(t));
		});
	});
}

function testCreateWithCustomGetReferrerHTML (t) {
	const s = mockup((err, address) => {
		t.ifError(err, '... while mockup does not error');

		let called = false;

		const f = dereferrer.createExpress({
			getReferrerHTML: (req, referrerURL, callback) => {
				called = true;
				return dereferrer.getReferrerHTML(req, referrerURL, callback);
			}
		});

		const req = {
			headers: {
				referer: address
			}
		};

		f(req, {}, err => {
			t.ifError(err, '... that does not error');
			t.ok(called, '... that allows overriding `getReferrerHTML` function');
			s.close(t.end.bind(t));
		});
	});
}

function testCreateWithErrorsDisabled (t) {
	const s = mockup(err => {
		t.ifError(err, '... while mockup does not error');

		const f = dereferrer.createExpress({
			errors: false
		});

		const req = {
			headers: {}
		};
		f(req, {}, err => {
			t.ifError(err, '... that does not error when `errors` are disabled');
			s.close(t.end.bind(t));
		});
	});
}

test('It should provide middleware creator...', t => {
	const f = dereferrer.createExpress();
	t.strictEqual(typeof f, 'function', '... that should be a function');

	t.test('... that works with overriden `getReferrerURL`', testCreateWithCustomGetReferrerURL);
	t.test('... that works with overriden `getReferrerHTML`', testCreateWithCustomGetReferrerHTML);
	t.test('... that works with silent errors', testCreateWithErrorsDisabled);

	t.end();
});
