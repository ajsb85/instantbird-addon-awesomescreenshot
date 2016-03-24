var previousTimestampContent = -1;
//document.getElementById('action_panel').addEventListener('click', function(e) {
//	log('aaaa');
//	switch (e.target.value) {
//	
//	case 'Close':
//		sendMessage('back', {name:'close_panel',data:null});
//		break;
//	}
//},false);
// send message to content page or add-on process

function sendMessage(receiver, message) {
	function getTimestamp() {
		var d = new Date();
		return Date.parse(d) + d.getUTCMilliseconds();
	}
	
	switch(receiver) {
	case 'front':
		// this didn't work. content page can't get notified
		document.getElementById('messageChannel').setAttribute('message', JSON.stringify({
				name: message.name,
				data: message.data,
				direction: 'back_front',
				timestamp: getTimestamp()
			}));
		break;
	case 'back':
		self.port.emit("message",message);
		break;
	}
}

// listen message from content page
document.getElementById('messageChannel').addEventListener('DOMSubtreeModified', function(e) {
	// console.log('messagechange')
	function validateMessage(currentTimestamp) {
		if (previousTimestampContent === currentTimestamp) {
			return false;
		}
		else {
			previousTimestampContent = currentTimestamp;
			return true;
		}
	}

	var message = JSON.parse(e.target.getAttribute('message'));
	
	if (message.direction==='front_back' && validateMessage(message.timestamp)) {
		sendMessage('back', message);
	}
  }, 
false);

// listen message from add-on process
self.port.on('message', function(message) {
	sendMessage('front', message);
});

self.port.emit("message",{name:'getoption'});