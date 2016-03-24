var request = require('sdk/request');

/* var api = {
	cmd : 'imageUpload',
	pv	: '1.0',
	cv	:	'1.0',
	ct	: 'firefox',
	url	: 'http://awesomescreenshot.com/client?'
};

function sendRequest(message, callback) {
	request.Request({
		url: api.url + 'cmd=' + api.cmd + '&pv=' + api.pv + '&ct=' + api.ct + '&cv=' + api.cv,
		content: JSON.stringify(message.data),
		onComplete: callback
	}).post();
} */

function sendRequest(message, callback) {
	request.Request({
		url: message.url,				// string
		content: message.data,	// object
		onComplete: callback
	}).post();
}

exports.request = sendRequest;