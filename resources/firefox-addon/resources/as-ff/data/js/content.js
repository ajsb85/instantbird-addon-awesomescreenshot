//var document=unsafeWindow.document,$=unsafeWindow.$,W = unsafeWindow,Diigo = unsafeWindow.Diigo;

var exit = document.getElementById('exit');
if (exit) {
	exit.addEventListener('click', function(e) {
		self.postMessage({name:'exit'});
	}, false);
}
	
var saveOnline = document.getElementById('saveOnline');
if (saveOnline) {	
	saveOnline.addEventListener('click', function(e) {
		if (/save/.test(e.target.className)) {
			// hide upload button
			$('.button.save').parent('.as').hide('fast');
			$('#loader').fadeIn('slow').find('a').hide();//.unbind('click').click(abortUpload);
			
			var src = document.getElementById('save-image').src
				.replace(/^data:image\/(png|jpeg);base64,/, "");
			
			self.postMessage({
				name:'upload', 
				data: {
					src_url: taburl,
					src_title: tabtitle,
					image_md5 : $.md5(src),
					image_type: 'jpg',
					image_content: src
				}
			});
		}
	}, false);
}

self.on('message', function(message) {
	switch(message.name) {
//	case 'ready':
//		sendMessage(message);
//		initEdit(message);
//		break;
	case 'upload':
		$('#loader').hide();
		
		var res = JSON.parse(message.data.text);
		if (message.data.status === 200 && res.code == 1) {
			showShare(res.result.url);
		}
		else {
			errorHandle();
		}
		break;
	
	default:
		sendMessage(message);
	}		
});

//self.postMessage({name:'ready'});

/* message channel */

var previousTimestamp = -1;

// Only changes from our script allowed
function validateMessage(currentTimestamp) {
	if (previousTimestamp === currentTimestamp) {
		return false;
	}
	else {
		previousTimestamp = currentTimestamp;
		return true;
	}
}

function getTimestamp() {
	var d = new Date();
	return Date.parse(d) + d.getUTCMilliseconds();
}

function sendMessage(message) {
	document.getElementById('messageChannel')
		.setAttribute('message', JSON.stringify({
			name: message.name,
			data: message.data,
			direction: 'sync_to_app',
			timestamp: getTimestamp()
		}));
}

// listen message from main.js
/* self.on('message', function(message) {
	sendMessage(message);
} */

// listen message from edit.js
document.getElementById('messageChannel')
	.addEventListener('DOMSubtreeModified', function(e) {


	var message = JSON.parse(e.target.getAttribute('message'));
	if (message.direction==='sync_to_app' || !validateMessage(message.timestamp)) {
		return;
	}
	
	self.postMessage(message);
}, false);