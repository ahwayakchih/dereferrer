/**
 * @module dereferrer
 */

const qs      = require('querystring');
const url     = require('url');
const needle  = require('needle');
const getIP   = require('ipware')().get_ip;

const meta    = require('./package.json');

/**
 * HTTP request
 *
 * @external "http.IncomingMessage"
 * @see {@link https://nodejs.org/api/http.html#http_http_incomingmessage}
 */

/**
 * HTTP response
 *
 * @external "http.ServerResponse"
 * @see {@link https://nodejs.org/api/http.html#http_class_http_serverresponse}
 */

/**
 * Error message used when referrer URL cannot be found.
 *
 * @const
 * @type {Error}
 */
module.exports.ERROR_REFERRER_MISSING = 'No referrer URL could be found';

/**
 * User agent string used when requesting dereferred page.
 *
 * @const
 * @type {string}
 */
module.exports.USER_AGENT = meta.name + 'Bot/' + meta.version;

/**
 * Returns request referer or `ref` value passed in GET variables.
 *
 * @param {!external:"http.IncomingMessage"} req
 * @param {string}                           [queryName='ref']   Pass `false` to disable looking for URL in query string in case of missing `referer` HTTP header
 * @return {string}
 */
module.exports.getReferrerURL = function getReferrerURL (req, queryName) {
	var referrer = req.headers && req.headers.referer;
	var q;

	if (!referrer && queryName !== false) {
		q = qs.parse((url.parse(req.url || '').search || '').replace(/^\?/, ''));
		referrer = q && q[queryName || 'ref'];
	}

	return referrer;
};

/**
 * GETs HTML from referrer URL and call back with error (if any) and
 * HTML string (if there was no error).
 * Passes cookies from `req.headers.cookie` to requested URL.
 *
 * Calls back with error (or `null`). When no errors are found, calls back with
 * HTML string and referrerURL as second and third parameters.
 *
 * @param {!external:"http.IncomingMessage"} req
 * @param {string}                           [referrerURL]   Defaults to result of call to `getReferrerURL(req)`
 * @param {!Function}                        callback
 */
module.exports.getReferrerHTML = function getReferrerHTML (req, referrerURL, callback) {
	if (!callback && typeof referrerURL === 'function') {
		callback = referrerURL;
		referrerURL = null;
	}

	var referrer = referrerURL || null;

	if (!referrer) {
		referrer = module.exports.getReferrerURL(req);
	}

	if (!referrer) {
		return callback(new Error(module.exports.ERROR_REFERRER_MISSING));
	}

	needle.get(referrer, {
		parse_response: false,
		parse_cookies : true,
		user_agent    : module.exports.USER_AGENT,
		headers       : {
			'Cookie'         : (req.headers && req.headers.cookie) || '',
			'X-Forwarded-For': getIP(req).clientIp
		}
	}, (err, res) => {
		if (err) {
			return callback(err);
		}

		callback(null, res.body, referrer);
	});
};

/**
 * Middleware is a callback function that is compatible with Express and Connect.
 *
 * @external middleware
 * @see {@link http://expressjs.com/en/guide/writing-middleware.html}
 */

/**
 * Dereferrer function is compatible with Express and Connect middleware
 * (see {@link external:middleware}).
 *
 * It will try to get referrer URL from request `referer` header, falling back to
 * request `ref` URL parameter.
 * Once it finds referrer URL, it will GET HTML from it.
 *
 * It mutates its `req` parameter by adding some properties to it:
 * - `req.referrerURL` is NULL or string containing referrer URL
 * - `req.referrerHTML` is an HTML string (but only if HTML could be downloaded)
 *
 * Depending on context options it was created with (see {@link module:dereferrer.createExpress}), it
 * may call back `next` with errors or fail silently.
 *
 * @callback module:dereferrer.dereferrerExpress
 * @param {!external:"http.IncomingMessage"} req
 * @param {!external:"http.ServerResponse"}  res
 * @param {!Function}                        next
 */

/**
 * Create middleware compatible with Express and Connect.
 *
 * @param {Object}   configuration
 * @param {Function} [configuration.getReferrerURL]    Defaults to `dereferrer.getReferrerURL`
 * @param {Function} [configuration.getReferrerHTML]   Defaults to `dereferrer.getReferrerHTML`
 * @param {string}   [configuration.queryName="ref"]   Set to `false` to disable: {@link module:dereferrer.getReferrerURL}
 * @param {boolean}  [configuration.errors=true]       Enable to make dereferrer callback with error if something goes wrong.
 * @return {module:dereferrer.dereferrerExpress}
 */
module.exports.createExpress = function createDereferrerExpress (configuration) {
	const ctx = Object.assign({}, configuration);

	if (!ctx.getReferrerURL || !(ctx.getReferrerURL instanceof Function)) {
		ctx.getReferrerURL = module.exports.getReferrerURL;
	}

	if (!ctx.getReferrerHTML || !(ctx.getReferrerHTML instanceof Function)) {
		ctx.getReferrerHTML = module.exports.getReferrerHTML;
	}

	if (!ctx.hasOwnProperty('queryName')) {
		ctx.queryName = 'ref';
	}

	if (!ctx.hasOwnProperty('errors')) {
		ctx.errors = true;
	}

	return function dereferrerExpress (req, res, next) {
		req.referrerURL = ctx.getReferrerURL(req, ctx.queryName);

		if (!req.referrerURL) {
			if (ctx.errors) {
				return next(new Error(module.exports.ERROR_REFERRER_MISSING));
			}

			return next();
		}

		ctx.getReferrerHTML(req, req.referrerURL, (err, html) => {
			if (err && ctx.errors) {
				return next(err);
			}

			if (!err) {
				req.referrerHTML = html;
			}

			next();
		});
	};
};
