var previousTimestampOption = -1;

function log(info) {
	$('body')[0].innerHTML += info.toString();
}

function sendMessage(name, data) {
	function getTimestamp() {
		var d = new Date();
		return Date.parse(d) + d.getUTCMilliseconds();
	}
	
	$('#messageChannel').attr('message', 
		JSON.stringify({
			name: name,
			data: data,
			direction: 'front_back',
			timestamp: getTimestamp()
		})
	);
}
function bindMessageChannel() {
	$('#messageChannel').bind('DOMSubtreeModified', function(e) {	
		function validateMessage(currentTimestamp) {
			if (previousTimestampOption === currentTimestamp) {
				return false;
			}
			else {
				previousTimestampOption = currentTimestamp;
				return true;
			}
		}
		var message = JSON.parse(e.target.getAttribute('message'));
		if (message.direction==='back_front' && validateMessage(message.timestamp)) {
			switch(message.name) {
			case 'save_options':
				showTip('Options Saved');
				// Warning: if we don't send any data, we can't just asign it with null,
				// or content script can't receive message. Instead, we use ''.
				//sendMessage('close_panel', '');
				break;
			case 'sendoption':
				restoreOptions(message.data);
				break;
			}
		}
	});
}

function buildInput() {
	var keys = ['V', /* 'S', */ 'F'];

	var $input = $('<input type="text" disabled="disabled"></input>');
	/* for (var i=48; i<91; i++) {
		if (i>57 && i<65) continue;
		
		var c = String.fromCharCode(i);
		$('<option></option>').attr({value:c}).text(c)
			.appendTo($select);
	} */
	$input.appendTo($('.select'))
		.each(function(i) {
			this.value = keys[i];
		});
}
function bindInput() {
	var keyValid = true;
	
	function handleInput(e) {
		var target = e.target;
		if (target.type == 'text' && $(target).parent('.select').length) {
			var keyCode = e.keyCode;
			var value = target.value;
			var type = e.type;
			// 0-9, a-z
			if (keyCode>=48&&keyCode<=57 || keyCode>=65&&keyCode<=90) {
				if (e.type==='keydown')
				target.value = '';
			}
			else {
				if (e.type==='keyup')
				target.value = value.substring(0, value.length-1);
			}
		}	
	}
	
	$('#shortcuts_table').click(function(e) {
		var target = e.target;
		var $siblingsTd = $(target).parent().siblings('td');
		
		//toggle if enable shortcut
		if (target.type == 'checkbox') {
			var $pairingSelect = $('input', $siblingsTd);
			if ($(target).attr('checked')) 
				$pairingSelect.removeAttr('disabled');
			else 
				$pairingSelect.attr({disabled:'disabled'});
		}
	})
	.keydown(handleInput)
	.keyup(handleInput);
}

function saveOptions() {
	var options = {};
	
	// format
	options.format = $('input[name="format"]:checked').attr('id');
	options.enableShortcut = $('#shortcurEnable').is(':checked');
	////menu shortcuts
	//var msObj = {};
	//$('input:checkbox', $('#menu_shortcuts')).each(function() {
	//	var id = this.id,
	//		enable = this.checked,
	//		key = $('input', $(this).parent().siblings('td.select')).attr('value');
	//
	//	msObj[''+id] = {enable:enable, key:key};
	//});
	//options.shortcuts = msObj;

	//options.superfish = document.getElementById('superfish').checked;
	
	sendMessage('save_options', options);
}
function bindActionPanel() {
	$('#action_panel').click(function(e) {
		function checkDuplicateKeys() {
			var keys = '', d = 0;
			$('input', $('td.select')).each(function() {
				var v = this.value;
				keys += v;
				
				if(keys.match(new RegExp(v, 'gi')).length > 1) {
					d = 1;
				}
			});
			return d;
		}
		
		if (e.target.tagName == 'INPUT') {
			switch (e.target.value) {
			case 'Reset':
				sendMessage('reset_options', '');
				location.href = location.href;
				break;
			case 'Save':
				if (checkDuplicateKeys()) {
					$('#tip').addClass('error');
					showTip('Shortcut Keys Conflict');
				}
				else {
					saveOptions(); 
					$('#tip').removeClass('error');
				}
				break;
			case 'Close':
				sendMessage('close_panel', '');				
				break;
			}
		}
	});
}

$(document).ready(function() {
	if (localStorage['reset'] && localStorage['reset'] == 'true') {
		showTip('Options Reseted');
		localStorage.removeItem('reset');
	}
	
	bindMessageChannel();
	
	buildInput();
	bindInput();
	bindActionPanel();



});

function buildSelect() {
	var keys = ['V', 'S', 'E'];

	var $select = $('<select disabled="disabled"></select>');
	for (var i=48; i<91; i++) {
		if (i>57 && i<65) continue;
		
		var c = String.fromCharCode(i);
		$('<option></option>').attr({value:c}).text(c)
			.appendTo($select);
	}
	$select.appendTo($('.select'))
		.each(function(i) {
			this.value = keys[i];
		});
}

function bindSelect() {
	$('#shortcuts_table').click(function(e) {
		var target = e.target;
		var $siblingsTd = $(target).parent().siblings('td');
		
		//select shortcut
		if (target.tagName == 'SELECT' && $('input', $siblingsTd).attr('checked')) {
			$('select', $('#menu_shortcuts')).not(target).each(function() {
				$('option[disabled]', $(this)).removeAttr('disabled');
				$('option[value='+this.value+']', $(target)).attr({disabled:'disabled'});
			});
		}
		//toggle if enable shortcut
		if (target.type == 'checkbox') {
			var $pairingSelect = $('select', $siblingsTd);
			if ($(target).attr('checked')) 
				$pairingSelect.removeAttr('disabled');
			else 
				$pairingSelect.attr({disabled:'disabled'});
		}
	});
}





function restoreOptions(data) {
	//image format
	if (data['format']) {
		$('#'+data['format']).attr({checked:'checked'})
			.siblings('input:checked').removeAttr('checked');
	}

	$('#shortcurEnable')[0].checked = data.enableShortcut;


}



function showTip(text) {
	$('#tip').slideDown('fast').delay(2000).fadeOut('slow')
		.find('span').text(text);
}