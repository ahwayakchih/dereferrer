dereferrer
==========

This module is just a tiny helper that loads HTML from referrer URL found in request.


## Installation

```sh
npm install dereferrer
```

or:

```sh
npm install https://github.com/ahwayakchih/dereferrer
```


# Usage

With Express/Connect:

```javascript
app.use(require('dereferrer').createExpress());

app.use(function (req, res, next) {
	console.log('Dereferred:', req.referrerURL, req.referrerHTML);
});
```

Standalone:

```javascript
const dereferrer = require('dereferrer').getReferrerHTML;

dereferrer(req, function (err, referrerHTML, referrerURL) {
	console.log('Dereferred:', referrerHTML, referrerURL);
});
```
