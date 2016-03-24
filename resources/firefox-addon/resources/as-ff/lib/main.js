var self = require('sdk/self');
var tabs = require('sdk/tabs');
var pageMod = require('sdk/page-mod');
var ui = require('ui');
var upload = require('upload');
var ss = require("sdk/simple-storage");
var storage = ss.storage;
var data = self.data;
var captureData;
var ff_dcm_starup = require('ff-dcm-startup');
var ff_dcm_client = require('ff-dcm-client');
var hex_md5 = require('md5');
var {Cc, Ci, Cu} = require("chrome");
var notifications = require("sdk/notifications");
var mediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);

// edit
pageMod.PageMod({
	//the new jetpack version modify the jetpack resource page url
	include: 'resource://jid0-gxjllfbcoax0lcltedfrekqdqpi-at-jetpack/*',
	contentScriptWhen: 'ready',
	contentScriptFile: [data.url('js/content.js')],
	onAttach: function(worker) {
		worker.on('message', function(message) {
			switch(message.name) {
			case 'ready':
//				captureData = ui.getCaptureData();
//				captureData.name = 'ready';
//				captureData.type = 'visible';
//				captureData.saveImageFormat = storage.options.format;
//				worker.postMessage(captureData);
				captureData = ui.getCaptureData();
				captureData.type = 'visible';
				captureData.saveImageFormat = storage.options.format;
				worker.postMessage({name: 'ready', data: captureData});
				break;
			case'exit':
				tabs.activeTab.close();
				break;
			case 'signin':	// diigo
			case 'loadUserInfo':
			case 'uploadItems':
				upload.request(message, function(response) {
					worker.postMessage({
						name: message.name,
						data: {status:response.status, text:response.text}
					});
				});
				break;

			case 'saveCanvas':
				ui.saveCanvas(message.data);
				break;

			case 'login_by_google':
				function urlReady(tab) {
					if (tab.url!='http://www.diigo.com/account/ffe_login_suc')
						return;

					worker.postMessage({
						name: 'login_by_google',
						data: {status: 200, text: null}
					});
					tabs.removeListener('ready', urlReady);
					tab.close();
					for (i in tabs) {
						if (tabs[i].url === data.url('app.html')) {
							return tabs[i].activate();
						}
					}
				}
				tabs.on('ready', urlReady);
				break;
			case 'login_by_diigo':
			case 'request_user_id':
			case 'load_user_info':
			case 'check_permission':
			case 'upload_to_diigo':
			case 'upload_to_as':
				upload.request(message, function(response) {
					worker.postMessage({name: message.name,
						data: {status: response.status, text: response.text}
					});
				});
				break;
			}
		});
	}
});

function initad(){
	//-1 for insert alert
	//0 for disable and not insert alert
	//1 for insert ad script
	storage.ads={
		superfish:-1
	}

}

if(!storage.userid){
	var u1 = Date.parse(new Date()) / 1000;
    var u2 = parseInt(Math.random()*10+1);
    var u3 = ''+u1+u2;
    var userid = hex_md5.hex_md5(u3);
    storage.userid = userid;
}

function initOptions() {
	storage.options = {
		format:'png',
		shortcuts:{
			"visible":{"enable":false,"key":"V"},
			"entire":{"enable":false,"key":"F"}
		},
		superfish:false
	};
}
function initCustomize() {
	storage.customize = {
		parent:'nav-bar',
		next:null
	};
}

if (!storage.ads) initad();
if (!storage.options) initOptions();
if (!storage.customize) initCustomize();
// var superfishflag = 0;
//this is for insert alert


ui.init();





// if(storage.ads.superfish==1){
// 	superfishflag = 1;
// 	console.log('flag');
// 	insertsuperfish();
// }



// console.log('106',storage.ads.superfish);

// if(storage.ads.superfish==-1){
	// pageMod.PageMod({
	// 	include:["http://www.amazon.com/*","http://www.amazon.de/*","http://www.amazon.fr/*","http://www.amazon.co.uk/*","http://www.ebay.com/*","http://www.ebay.co.uk/*","http://www.ebay.com.au/*","http://www.ebay.fr/*","http://www.ebay.de/*","https://www.amazon.com/*","https://www.amazon.de/*","https://www.amazon.fr/*","https://www.amazon.co.uk/*","https://www.ebay.com/*","https://www.ebay.co.uk/*","https://www.ebay.com.au/*","https://www.ebay.fr/*","https://www.ebay.de/*"],  //test for all urls
	// 	contentScriptWhen:'ready',
	// 	contentScriptFile: [data.url('js/alert.js')],
	// 	onAttach:function onAttach(worker){
	// 		worker.on('message', function(message) {
	// 			// console.log('114',message.name,message.action);
	// 			switch(message.name) {
	// 				case 'superfish':
	// 					switch(message.action){
	// 						case 'allow':
	// 							storage.ads.superfish=1;
	// 							storage.options.superfish=true;
	// 							var superfishjs = "http://www.superfish.com/ws/sf_main.jsp?dlsource=Diigoscreenshot&CTID=firefox&userId=" + storage.userid;
	// 							tabs.activeTab.attach({
	// 							 	contentScript: 'var x=document.createElement("SCRIPT");'
	// 							 				  +'x.src="'+superfishjs+'"; x.defer=true; '
	// 							 				  +'document.getElementsByTagName("HEAD")[0].appendChild(x);'
	// 							});
	// 						break;
	// 						case 'cancle':
	// 							storage.ads.superfish = 0;
	// 						break;
	// 						case 'nerver':
	// 							storage.ads.superfish = -2;
	// 						break;
	// 						case 'getoption':
	// 							worker.postMessage({name:'sendoption',superfish:storage.ads.superfish})
	// 						break
	// 					}
	// 					break;
	// 			}
	// 		});
	// 	}
	// });



// }









// options


// pageMod.PageMod({
// 	include: data.url('options.html'),
// 	contentScriptWhen: 'ready',
// 	contentScriptFile: data.url('js/options-content.js'),
// 	onAttach: function(worker) {
// 		worker.on('message', function(message) {
// 			console.log(message.name);
// 			switch(message.name) {
// 			case 'reset_options':
// 				initOptions();
// 				break;
// 			case 'save_options':
// 				storage.options = message.data;
// 				if(message.data.superfish) storage.ads.superfish=1;
// 				else storage.ads.superfish=0;
// 				worker.postMessage({name:message.name, data:''});
// 				break;
// 			case 'close_panel':
// 				ui.closePanel();
// 				// console.log(message.data);
// 				break;
// 			case 'getoption':
// 				worker.postMessage({name:'sendoption',data:storage.options});
// 				break
// 			}
// 		});
// 	}
// });







//require("widget").Widget({
//  id: "google-link",
//  label: "Widget with an image and a click handler",
//  contentURL: data.url('img/icon16.png'),
//  onClick: function() {
//    panel.show();
//  }
//});

//ff-dcm

var startup = new ff_dcm_starup.startup();
