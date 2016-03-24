var {Cc, Ci, Cu} = require("chrome");
var { Hotkey } = require("sdk/hotkeys");
var self = require("sdk/self");
var data = require('sdk/self').data;
var windows = require('sdk/windows');
var tabs = require('sdk/tabs');
var panel = require("sdk/panel");
var cm = require("sdk/context-menu");
var { ToggleButton } = require('sdk/ui/button/toggle');
var xulApp = require('sdk/system/xul-app');
var ui = require("sdk/ui");
var ss = require("sdk/simple-storage");
var storage = ss.storage;
var captureData = {};
var optionsPanel;
var mediator = Cc['@mozilla.org/appshell/window-mediator;1']
	.getService(Ci.nsIWindowMediator);
var AddonManager = Cu.import("resource://gre/modules/AddonManager.jsm").AddonManager;
var PrivateBrowsingUtils = Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm").PrivateBrowsingUtils;

var visibleKey,entireKey;


var popupPanel,toolbarButton;

function closePanel() {
	optionsPanel.hide();
}

function getTimeStamp() {
	var y, m, d, h, M, s; 
	var time = new Date();
	y = time.getFullYear();
	m = time.getMonth()+1;
	d = time.getDate();
	h = time.getHours();
	M = time.getMinutes();
	s = time.getSeconds();
	if (m < 10) m = '0' + m;
	if (d < 10) d = '0' + d;
	if (h < 10) h = '0' + h;
	if (M < 10) M = '0' + M;
	if (s < 10) s = '0' + s;
	return 	y + '-' + m + '-' + d + ' ' + h + '-' + M + '-' + s;
}

function saveCanvas(data) {
	var format = data.format;
	var window = mediator.getMostRecentWindow("navigator:browser").gBrowser.contentWindow;
	var nsIFilePicker = Ci.nsIFilePicker;
	var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window.parent, "Save Image To", nsIFilePicker.modeSave);
	//fp.appendFilter('image',Components.interfaces.nsIFilePicker.filterimg);
	//fp.defaultExtension = 'PNG';
	fp.defaultString = data.title+' '+getTimeStamp()+'.'+format;
	fp.appendFilter(format.toUpperCase()+' Image', '*.'+format);
		
	var show = fp.show();
	if (show!=nsIFilePicker.returnCancel) {
		var targetDir = fp.file; 
		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile); 
		var path = targetDir.path;// + (show==nsIFilePicker.returnOK ? '.png' : '');
		
		var regex = new RegExp('.'+format);
		if (!regex.test(path)) {
			path += '.'+format;
		}	
		
		file.initWithPath(path); 

		// create a data url from the canvas and then create URIs of the source and targets
		var io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var source = io.newURI(data.dataURL, "UTF8", null);
		var target = io.newFileURI(file);
		// prepare to save the canvas data
		var persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
														.createInstance(Ci.nsIWebBrowserPersist);
		
		//persist.persistFlags = Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
		persist.persistFlags = Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION; 
		
		//var targetFile = targetDir.clone();
		
		// displays a download dialog (remove these 3 lines for silent download)

//        var privacyContext = window.QueryInterface(Ci.nsIInterfaceRequestor)
//                                   .getInterface(Ci.nsIWebNavigation)
//                                   .QueryInterface(nsILoadContext);

        var privacyContext = PrivateBrowsingUtils.privacyContextFromWindow(window);

		var xfer = Cc["@mozilla.org/transfer;1"].createInstance(Ci.nsITransfer);
		xfer.init(source, target, "", null, null, null, persist,privacyContext);
		persist.progressListener = xfer;
//
		// save the canvas data to the file
		persist.saveURI(source, null, null, null, null,null, file, privacyContext);
	}
}

function capture(option) {
	var window = mediator.getMostRecentWindow("navigator:browser").gBrowser.contentWindow;
	var document = window.document;
	var html = document.documentElement;
	var w, h, x, y;
	switch(option) {
	case 'visible':
		x = 0;
		y = html.scrollTop;
		w = html.clientWidth;
		h = html.clientHeight;
		break;
	case 'entire':
		x = y = 0;
		w = html.scrollWidth;
		h = html.scrollHeight;
		break;
	}
	
	var canvas = document.createElement('canvas');
	canvas.width = w; 
	canvas.height = h; // need refinement
	canvas.style.display = 'none';
	document.body.appendChild(canvas);
	
	var ctx = canvas.getContext("2d");
	ctx.drawWindow(window, x, y, w, h, 'rgb(255, 255, 255)');
	
	captureData = {
		data: canvas.toDataURL(),
		taburl: window.location.href,
		tabtitle: document.title,
		w: w, h:h
	};
	tabs.open({url: data.url('edit.html')});
}
function getCaptureData() {
	return captureData;
}

function createKeySet(doc) {
	var keyset = doc.createElement('keyset');
	var visibleKey = doc.createElement('key');
	
	visibleKey.setAttribute('id', 'visibleKey');
	visibleKey.setAttribute('modifiers', 'control shift');
	visibleKey.setAttribute('key', 'V');
	visibleKey.setAttribute('oncommand', 'capture(\'visible\')');
	
	keyset.appendChild(visibleKey);
	return keyset;
}

function createMenuPopup(doc) {
	var menupopup = doc.createElement('menupopup');
	var visibleItem = doc.createElement('menuitem');
	var entireItem = doc.createElement('menuitem');
	menupopup.setAttribute('class', 'awesome-screenshot-menupopup');
	visibleItem.setAttribute('data-option', 'visible');
	entireItem.setAttribute('data-option', 'entire');
	visibleItem.setAttribute('class', 'menuitem-iconic');
	entireItem.setAttribute('class', 'menuitem-iconic');
	visibleItem.setAttribute('label', 'Capture Visible Part');
	entireItem.setAttribute('label', 'Capture Full page');
	visibleItem.setAttribute('image', data.url('img/visible.png'));
	entireItem.setAttribute('image', data.url('img/entire.png'));
	visibleItem.setAttribute('key', 'visibleKey');
	
	var separator = doc.createElement('menuseparator');
	
	var options = doc.createElement('menuitem');
	options.setAttribute('data-option', 'options');
	options.setAttribute('label', 'Options');
	
	menupopup.appendChild(visibleItem);
	menupopup.appendChild(entireItem);
	menupopup.appendChild(separator);
	menupopup.appendChild(options);
	return menupopup;
}
function prepareKeys(doc, container) {
	//container.appendChild(createKeySet(doc));
	doc.addEventListener('keyup', function(e) {
		//console.log(e.keyCode);
	}, false);
}
// called by addToolbarButton and addContextMenu
function prepareMenu(doc, container, wrapper) { 
	container.appendChild(wrapper);
	wrapper.appendChild(createMenuPopup(doc));
	
	// maybe change to menupopup
	wrapper.addEventListener('mousedown', function(e) {
		var target = e.target; 
		// XULElement don't have parentElement property, so we use parentNode
		if (/awesome-screenshot-menupopup/.test(target.parentNode.className) 
			&& e.which===1) {
			
			var action = target.getAttribute('data-option');
			if (action==='options') {
				optionsPanel.port.emit("message",{name:'sendoption',data:storage.options});
				optionsPanel.show();
			}
			else capture(action);
		}	
	}, false);
}
function addToolbarButton(doc) {
	var addonBar = doc.getElementById("nav-bar");
	if (!addonBar) return;
	var toolbarbutton = doc.createElement("toolbarbutton"); 	
	
	var id = toolbarbutton.id = 'awesome-screenshot-toolbarbutton';
	toolbarbutton.setAttribute('type', 'menu');
	toolbarbutton.setAttribute('class', 'toolbarbutton-1 chromeclass-toolbar-additional');
	toolbarbutton.setAttribute('image', data.url('img/icon16.png'));
	toolbarbutton.setAttribute('orient', 'horizontal');
	toolbarbutton.setAttribute('label', 'Awesome Screenshot');
	
	doc.defaultView.addEventListener("aftercustomization", function() {
		var as = doc.getElementById(id);
		storage.customize = {
			parent: as ? as.parentNode.id : null,
			next: as ? as.nextSibling.id : null
		};
	}, false);
	
	//prepareKeys(doc, addonBar);
	prepareMenu(doc, addonBar, toolbarbutton);
	doc.getElementById("navigator-toolbox").palette.appendChild(toolbarbutton);
	
	var parent = storage.customize.parent;
	var next = storage.customize.next;
	if (parent) doc.getElementById(parent).insertItem(id, doc.getElementById(next), null, false);
}
function addContextMenu(doc) {
	var popup = doc.getElementById('contentAreaContextMenu');
	if (!popup) return;
	var menu = doc.createElement('menu');
	
	menu.setAttribute('id', 'awesome-screenshot-contextmenu');
	menu.setAttribute('label', 'Awesome Screenshot');
	menu.setAttribute('class', 'menu-iconic');
	menu.setAttribute('image', data.url('img/icon16.png'));
	
	prepareMenu(doc, popup, menu);
}

var isShort = false;
function addShortcuts(win) {

	if(isShort) return;
	isShort = true;

	visibleKey = Hotkey({
		combo:'accel-shift-i',
		onPress:function(){
			capture('visible');
		}
	});

	 entireKey = Hotkey({
		combo:'accel-shift-e',
		onPress:function(){
			 capture('entire');
		}
	});

}

function removeShortcuts(){
	if(!isShort) return;
	isShort = false;
	visibleKey.destroy();
	entireKey.destroy();
}

function addUI(win) {
	win = win || mediator.getMostRecentWindow("navigator:browser");
	var doc = win.document;
	
	addToolbarButton(doc);
	addContextMenu(doc);

	addShortcuts(win);

	if(!storage.options.enableShortcut){
		removeShortcuts();
	}
}
function removeUI(win) {
	var doc = win.document;
	
	var addonBar = doc.getElementById("nav-bar");
	var button = doc.getElementById("awesome-screenshot-toolbarbutton");
	if (button) addonBar.removeChild(button);
	
	var popup = doc.getElementById('contentAreaContextMenu');
	var menu = doc.getElementById("awesome-screenshot-contextmenu");
	if (menu) popup.removeChild(menu);
}

function addAll() {
	var enumerator = mediator.getEnumerator(null);
	while(enumerator.hasMoreElements()) {
		addUI(enumerator.getNext());
	}
}
function removeAll() {
	var enumerator = mediator.getEnumerator(null);
	while(enumerator.hasMoreElements()) {
		removeUI(enumerator.getNext());
	}
}


function toolbarChange(state){
    if(state.checked){
        popupPanel.show({
            position:toolbarButton
        });
    }
}

function popupHide(){
    toolbarButton.state('window',{checked:false});
}

function addToolbarButtons(){
	toolbarButton = ToggleButton({
        id:'awesome-screenshot-toolbarbutton',
        label:'Awesome Screenshot',
        icon:{
            "16":'./img/icon16.png',
            "32":'./img/icon32.png',
            "64":'./img/icon64.png'
        },
        onChange:toolbarChange
    });

    popupPanel = panel.Panel({
        width:300,
        height:100,
        contentURL:data.url('popup.html'),
        onHide:popupHide
    });

    popupPanel.port.on('capture',function(text){
        switch (text){
            case 'visible':
                capture('visible');
                break;
            case 'entire':
                capture('entire');
                break;
            case 'options':
                optionsPanel.port.emit("message",{name:'sendoption',data:storage.options});
                optionsPanel.show();
                break;
        }
        popupPanel.hide();
    });
}

function addCotextMenuButtons(){
    cm.Menu({
        label:'Awesome Screenshot',
        image:data.url('img/icon16.png'),
        items:[
            cm.Item({
                label:'Capture Visible Part of page',
                contentScript:'self.on("click",function(){self.postMessage("visible")})',
                onMessage:function(text){
                    if(text=='visible'){
                        capture('visible');
                    }
                }
            }),
            cm.Item({
                label:'Capture entire page',
                contentScript:'self.on("click",function(){self.postMessage("entire")})',
                onMessage:function(text){
                    if(text=='entire'){
                        capture('entire');
                    }
                }
            })
        ]
    })
}

function init(capture) {
	//AddonManager.addAddonListener({
	//	onDisabled: function(addon) {
	//		if (addon.id==='jid0-GXjLLfbCoAx0LcltEdFrEkQdQPI@jetpack') {
	//			removeAll();
	//		}
	//	}
	//});
	//windows.browserWindows.on('open', function(window) {
	//	addUI(null);
	//});
	//removeAll();
	//addAll();
    removeAll();
	addToolbarButtons();
    addCotextMenuButtons();
	addShortcuts();
	optionsPanel = panel.Panel({
	  	contentURL: data.url("options.html"),
		width: 590, height: 285,
		contentScriptWhen: 'ready',
		contentScriptFile: data.url('js/options-content.js'),
		// port: function(worker) {
		// 	worker.on('message', function(message) {
		// 		console.log(message.name);
		// 		switch(message.name) {
		// 		case 'reset_options':
		// 			initOptions();
		// 			break;
		// 		case 'save_options':
		// 			storage.options = message.data;
		// 			if(message.data.superfish) storage.ads.superfish=1;
		// 			else storage.ads.superfish=0;
		// 			worker.postMessage({name:message.name, data:''});
		// 			break;
		// 		case 'close_panel':
		// 			ui.closePanel();
		// 			// console.log(message.data);
		// 			break;
		// 		case 'getoption':
		// 			worker.postMessage({name:'sendoption',data:storage.options});
		// 			break
		// 		}
		// 	});
		// }
	});

	optionsPanel.port.on("message",function(message){
		switch(message.name){
			case 'reset_options':
				storage.options = {
					format:'png',
					shortcuts:{
						"visible":{"enable":false,"key":"V"},
						"entire":{"enable":false,"key":"F"}
					},
					superfish:false
				};
				break;
			case 'save_options':
				storage.options = message.data;
				if(storage.options.enableShortcut){
					addShortcuts()	;
				}else{
					removeShortcuts();
				}
				optionsPanel.port.emit("message",{name:message.name, data:''});
				break;
			case 'close_panel':
				closePanel();
				// console.log(message.data);
				break;
			case 'getoption':
				optionsPanel.port.emit("message",{name:'sendoption',data:storage.options});
				break
		}
	});
	
}

exports.init = init;
exports.getCaptureData = getCaptureData;
exports.saveCanvas = saveCanvas;
exports.closePanel = closePanel;
